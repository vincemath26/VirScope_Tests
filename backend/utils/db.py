# db.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import ArgumentError
from dotenv import load_dotenv

load_dotenv()

# Get DATABASE_URL from environment
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set!")

# Ensure SSL is required (Render Postgres)
if "sslmode" not in DATABASE_URL:
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL += "?sslmode=require"
    else:
        DATABASE_URL += "&sslmode=require"

try:
    engine = create_engine(
        DATABASE_URL,
        echo=False,         # Set to True for debugging SQL
        future=True         # SQLAlchemy 2.x style
    )
except ArgumentError as e:
    raise RuntimeError(f"Error creating SQLAlchemy engine: {e}")

# Create a session factory
Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
