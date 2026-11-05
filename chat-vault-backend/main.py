import os
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.sql import func
from zhipuai import ZhipuAI
from dotenv import load_dotenv
from jose import JWTError, jwt
import bcrypt

load_dotenv()

# ================= 数据库配置 =================
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ================= 数据库模型 =================
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)

class Conversation(Base):
    __tablename__ = "conversations"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String, default="新对话")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"))
    role = Column(String) # "user" 或 "ai"
    content = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Favorite(Base):
    __tablename__ = "favorites"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    message_id = Column(Integer, ForeignKey("messages.id"), unique=True) # 防止重复收藏
    question = Column(Text) # 快照，方便展示
    answer = Column(Text)   # 快照，方便展示
    created_at = Column(DateTime(timezone=True), server_default=func.now())

# 初始化表结构
Base.metadata.create_all(bind=engine)

# ================= FastAPI 配置 =================
app = FastAPI(title="ChatVault API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # 生产环境建议改为你的域名，如 "https://ai.m3u8player.com.cn"
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRET_KEY = "your-super-secret-key-please-change-this"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

# ================= Pydantic 模型 =================
class UserRegister(BaseModel):
    username: str
    password: str

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[int] = None

class FavoriteRequest(BaseModel):
    message_id: int
    question: str
    answer: str

# ================= 依赖项 =================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(status_code=401, detail="无效的认证凭证")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

# ================= 接口定义 =================

@app.post("/api/register")
def register(req: UserRegister, db: Session = Depends(get_db)):
    password_bytes = req.password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed_pwd = bcrypt.hashpw(password_bytes, salt).decode('utf-8')
    
    existing = db.query(User).filter(User.username == req.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="用户名已存在")
        
    new_user = User(username=req.username, hashed_password=hashed_pwd)
    db.add(new_user)
    db.commit()
    return {"message": "注册成功"}

@app.post("/api/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
        
    is_valid = False
    if user:
        try:
            is_valid = bcrypt.checkpw(form_data.password.encode('utf-8'), user.hashed_password.encode('utf-8'))
        except Exception:
            pass

    if not user or not is_valid:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    encoded_jwt = jwt.encode({"exp": expire, "sub": user.username}, SECRET_KEY, algorithm=ALGORITHM)
    return {"access_token": encoded_jwt, "token_type": "bearer"}

# ---------------- 会话与消息管理 ----------------

@app.get("/api/conversations")
def get_conversations(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    convs = db.query(Conversation).filter(Conversation.user_id == current_user.id).order_by(Conversation.id.desc()).all()
    return {"items": convs}

@app.get("/api/conversations/{conv_id}/messages")
def get_messages(conv_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conv_id, Conversation.user_id == current_user.id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="会话不存在")
    
    messages = db.query(Message).filter(Message.conversation_id == conv_id).order_by(Message.id.asc()).all()
    return {"items": messages}

# 重命名会话
class RenameRequest(BaseModel):
    title: str

@app.put("/api/conversations/{conv_id}")
def rename_conversation(conv_id: int, req: RenameRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conv_id, Conversation.user_id == current_user.id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="会话不存在")
    
    conv.title = req.title.strip() or "新对话"
    db.commit()
    return {"message": "重命名成功"}

# 删除会话（级联删除）
@app.delete("/api/conversations/{conv_id}")
def delete_conversation(conv_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conv_id, Conversation.user_id == current_user.id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="会话不存在或无权删除")

    try:
        # 1. 获取该会话下的所有消息 ID
        messages = db.query(Message).filter(Message.conversation_id == conv_id).all()
        message_ids = [msg.id for msg in messages]

        # 2. 删除这些消息对应的收藏记录
        if message_ids:
            db.query(Favorite).filter(Favorite.message_id.in_(message_ids)).delete(synchronize_session=False)

        # 3. 删除该会话下的所有消息
        db.query(Message).filter(Message.conversation_id == conv_id).delete(synchronize_session=False)

        # 4. 最后删除会话本身
        db.delete(conv)
        db.commit()
        return {"message": "会话删除成功"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")
# ---------------- AI 对话 ----------------

@app.post("/api/chat")
async def chat(req: ChatRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="消息不能为空")

    # 1. 获取或创建会话
    if req.conversation_id is None:
        new_conv = Conversation(user_id=current_user.id, title=req.message[:10] + ("..." if len(req.message) > 10 else ""))
        db.add(new_conv)
        db.commit()
        db.refresh(new_conv)
        conv_id = new_conv.id
    else:
        conv_id = req.conversation_id
        conv = db.query(Conversation).filter(Conversation.id == conv_id, Conversation.user_id == current_user.id).first()
        if not conv:
            raise HTTPException(status_code=404, detail="会话不存在")

    # 2. 保存用户提问
    user_msg = Message(conversation_id=conv_id, role="user", content=req.message)
    db.add(user_msg)
    db.commit()

    # 3. 获取最近 10 条对话作为上下文
    history = db.query(Message).filter(Message.conversation_id == conv_id).order_by(Message.id.desc()).limit(10).all()
    history.reverse()
    
    api_messages = []
    for msg in history:
        api_messages.append({"role": "assistant" if msg.role == "ai" else "user", "content": msg.content})

    api_key = os.getenv("ZHIPUAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="未配置 ZHIPUAI_API_KEY")

    # 4. 定义流式生成器
    def generate():
        ai_reply = ""
        try:
            client = ZhipuAI(api_key=api_key)
            response = client.chat.completions.create(
                model="glm-4-flash",
                messages=api_messages,
                stream=True,
            )
            for chunk in response:
                content = chunk.choices[0].delta.content
                if content:
                    ai_reply += content
                    yield content
            
            # 5. 流式输出结束后，将 AI 回复存入数据库
            with SessionLocal() as session:
                ai_msg = Message(conversation_id=conv_id, role="ai", content=ai_reply)
                session.add(ai_msg)
                session.commit()
                # 返回格式：末尾带上本次 AI 消息的 ID，方便前端后续收藏
                yield f"\n\n__MSG_ID__:{ai_msg.id}__CONV_ID__:{conv_id}"
                
        except Exception as e:
            print(f"AI 报错: {e}")
            yield f"\n\n[AI 服务异常: {str(e)}]"

    return StreamingResponse(
        generate(), 
        media_type="text/plain",
        headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"}
    )

# ---------------- 收藏夹管理 ----------------

@app.post("/api/favorites")
def add_favorite(req: FavoriteRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # 防止重复收藏
    existing = db.query(Favorite).filter(Favorite.user_id == current_user.id, Favorite.message_id == req.message_id).first()
    if existing:
        return {"status": "ok", "message": "已经收藏过了"}

    fav = Favorite(
        user_id=current_user.id, 
        message_id=req.message_id, 
        question=req.question, 
        answer=req.answer
    )
    db.add(fav)
    db.commit()
    return {"status": "ok", "message": "收藏成功"}

@app.get("/api/favorites")
def get_favorites(
    q: str = "", 
    skip: int = 0, 
    limit: int = 10, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    query = db.query(Favorite).filter(Favorite.user_id == current_user.id)
    
    if q:
        search_pattern = f"%{q}%"
        query = query.filter((Favorite.question.ilike(search_pattern)) | (Favorite.answer.ilike(search_pattern)))
    
    total = query.count()
    items = query.order_by(Favorite.id.desc()).offset(skip).limit(limit).all()
    
    return {"items": items, "total": total}

@app.delete("/api/favorites/{fav_id}")
def delete_favorite(fav_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    fav = db.query(Favorite).filter(Favorite.id == fav_id, Favorite.user_id == current_user.id).first()
    if not fav:
        raise HTTPException(status_code=404, detail="找不到记录或无权删除")
    
    db.delete(fav)
    db.commit()
    return {"status": "ok", "message": "删除成功"}