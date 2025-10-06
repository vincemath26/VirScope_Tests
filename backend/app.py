import os
import io
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
from models.models import Base
from utils.db import engine
from routes.auth import auth_bp
from routes.collections import collection_bp
from routes.visualisation import visualisation_bp
from routes.converter import converter_bp
from utils.r2 import fetch_upload_from_r2

# ----------------- Load environment variables -----------------
load_dotenv()  # For local dev only; Render uses env vars in dashboard

# ----------------- Flask App Setup -----------------
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# Secret keys
app.config["SITE_PASSWORD"] = os.getenv("SITE_PASSWORD")
app.secret_key = os.getenv("FLASK_SECRET_KEY", 'fallback_default_secret')

# ----------------- Temporary Upload Folder -----------------
# Use /tmp/uploads for Render; safe and writable
TMP_UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', '/tmp/uploads')
os.makedirs(TMP_UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = TMP_UPLOAD_FOLDER

# ----------------- R2 Configuration -----------------
app.config['R2_BUCKET_NAME'] = os.getenv("R2_BUCKET_NAME")
app.config['R2_ACCESS_KEY_ID'] = os.getenv("R2_ACCESS_KEY_ID")
app.config['R2_SECRET_ACCESS_KEY'] = os.getenv("R2_SECRET_ACCESS_KEY")
app.config['R2_ENDPOINT'] = os.getenv("R2_ENDPOINT")

# ----------------- Database Initialization -----------------
with engine.begin() as connection:
    Base.metadata.create_all(bind=connection)

# ----------------- Basic Routes -----------------
@app.route("/")
def hello():
    return "Flask with PostgreSQL is working!"

@app.route("/health")
def health():
    return {"status": "ok"}, 200

# ----------------- Helper to read CSV from R2 -----------------
def read_csv_from_r2(filename):
    """
    Fetch CSV from R2 and return a BytesIO object for pandas.
    """
    file_bytes = fetch_upload_from_r2(filename)
    return io.BytesIO(file_bytes)

# ----------------- Register Blueprints -----------------
# Any route that reads uploads should use fetch_upload_from_r2 or load_upload_file
app.register_blueprint(auth_bp)
app.register_blueprint(collection_bp)
app.register_blueprint(visualisation_bp)
app.register_blueprint(converter_bp)

# ----------------- Entry Point -----------------
if __name__ == "__main__":
    # Local dev only; Render uses gunicorn
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)))
