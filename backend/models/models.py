from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'
    user_id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(120), unique=True, nullable=False)
    password = Column(String(255), nullable=False)
    uploads = relationship("Upload", back_populates="user")

class Upload(Base):
    __tablename__ = 'uploads'
    upload_id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    file_type = Column(String(20), nullable=False, default='base')  # 'base' or 'metadata'
    date_created = Column(DateTime, default=datetime.utcnow)
    date_modified = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    user_id = Column(Integer, ForeignKey('users.user_id'))
    workspace_id = Column(Integer, ForeignKey('workspaces.workspace_id'), nullable=True)
    user = relationship("User", back_populates="uploads")
    workspace = relationship("Workspace", back_populates="uploads")

class GraphText(Base):
    __tablename__ = 'upload_graph_texts'
    id = Column(Integer, primary_key=True)
    upload_id = Column(Integer, ForeignKey('uploads.upload_id'), nullable=False)
    graph_type = Column(String(50), nullable=False)  # 'heatmap', 'barplot', 'antigen_map'
    text = Column(Text, nullable=True)  # allow empty initially
    date_created = Column(DateTime, default=datetime.utcnow)
    date_modified = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    upload = relationship("Upload", back_populates="graph_texts")

class Workspace(Base):
    __tablename__ = "workspaces"
    workspace_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    date_created = Column(DateTime, default=datetime.utcnow)
    date_modified = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    uploads = relationship("Upload", back_populates="workspace", cascade="all, delete-orphan")

# Back-populates for GraphText
Upload.graph_texts = relationship("GraphText", back_populates="upload", cascade="all, delete-orphan")
