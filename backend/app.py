import os
from flask import Flask
from models.models import Base
from utils.db import engine
from routes.auth import auth_bp
from routes.collections import collection_bp
from routes.visualisation import visualisation_bp
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# Secret keys, I have an environment variable and a default key just in case
# the default does not work.
load_dotenv()
app.config["SITE_PASSWORD"] = os.getenv("SITE_PASSWORD")
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'NMxnqEclOjNZcr88uU5F8I0ntrb3-0qZPqP3SUl_OVk')

# Upload config
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'csv'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Create tables once at startup
with engine.begin() as connection:
    Base.metadata.create_all(bind=connection)

@app.route("/")
def hello():
    return "Flask with PostgreSQL is working!"

app.register_blueprint(auth_bp)
app.register_blueprint(collection_bp)
app.register_blueprint(visualisation_bp)

if __name__ == "__main__":
    app.run(debug=True)
