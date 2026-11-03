import os
from datetime import datetime, timedelta
from typing import List

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.sql import func
from zhipuai import ZhipuAI
from dotenv import load_dotenv
from jose import JWTError, jwt
import bcrypt

load_dotenv()

# ================= 数据库配置 =================
# 连接本地 SSH 隧道转发过来的端口
DATABASE_URL = "postgresql://admin:chatvault123@127.0.0.1:5433/chatvault"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ================= 数据库模型 =================
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)

class Favorite(Base):
    __tablename__ = "favorites"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    question = Column(Text)
    answer = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

# 创建所有表
Base.metadata.create_all(bind=engine)

# ================= FastAPI 初始化 =================
app = FastAPI(title="ChatVault API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://ai.m3u8player.com.cn", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = ZhipuAI(api_key=os.getenv("ZHIPUAI_API_KEY"))

SECRET_KEY = "your-super-secret-key-please-change-this"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

# ================= Pydantic 模型 =================
class ChatRequest(BaseModel):
    message: str

class FavoriteRequest(BaseModel):
    question: str
    answer: str

class FavoriteResponse(BaseModel):
    id: int
    question: str
    answer: str
    created_at: datetime

class UserRegister(BaseModel):
    username: str
    password: str

# ================= 数据库依赖 =================
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

# ================= 接口 =================

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

@app.post("/api/chat")
async def chat(req: ChatRequest):
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="消息不能为空")

    def generate():
        try:
            response = client.chat.completions.create(
                model="glm-4-flash",
                messages=[{"role": "user", "content": req.message}],
                stream=True,
            )
            for chunk in response:
                content = chunk.choices[0].delta.content
                if content:
                    yield content
        except Exception as e:
            print(f"AI 报错: {e}")
            yield "【AI 服务出现异常】"

    return StreamingResponse(generate(), media_type="text/plain")

@app.post("/api/favorites")
def add_favorite(req: FavoriteRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    fav = Favorite(user_id=current_user.id, question=req.question, answer=req.answer)
    db.add(fav)
    db.commit()
    return {"status": "ok", "message": "收藏成功"}

@app.get("/api/favorites")
def get_favorites(q: str = "", current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(Favorite).filter(Favorite.user_id == current_user.id)
    
    # 全文检索：如果传了 q 参数，进行模糊匹配
    if q:
        search_pattern = f"%{q}%"
        query = query.filter((Favorite.question.ilike(search_pattern)) | (Favorite.answer.ilike(search_pattern)))
        
    items = query.order_by(Favorite.id.desc()).all()
    return {"items": items}

@app.delete("/api/favorites/{fav_id}")
def delete_favorite(fav_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    fav = db.query(Favorite).filter(Favorite.id == fav_id, Favorite.user_id == current_user.id).first()
    if not fav:
        raise HTTPException(status_code=404, detail="找不到记录或无权删除")
    
    db.delete(fav)
    db.commit()
    return {"status": "ok"}