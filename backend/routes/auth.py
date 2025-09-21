from flask import Blueprint, request, jsonify, session
from sqlalchemy.orm import Session as SqlAlchemySession
from models.models import User
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
import datetime

# Define Blueprint
auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/check-site-password', methods=['POST'])
def check_site_password():
    from app import app
    data = request.get_json() or {}
    password = data.get('password')

    if not password:
        return jsonify({'error': 'Missing password'}), 400

    site_password = app.config.get('SITE_PASSWORD')

    if password == site_password:
        exp_time = datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        payload = {
            'site_access': True,
            'iat': datetime.datetime.utcnow(),
            'exp': exp_time
        }
        token = jwt.encode(payload, app.secret_key, algorithm='HS256')
        return jsonify({'message': 'Access granted', 'token': token}), 200

    return jsonify({'error': 'Invalid site password'}), 401

@auth_bp.route('/verify-site-token', methods=['POST'])
def verify_site_token():
    from app import app
    token = request.json.get('token')

    if not token:
        return jsonify({'error': 'Token missing'}), 400

    try:
        decoded = jwt.decode(token, app.secret_key, algorithms=['HS256'])
        if decoded.get('site_access'):
            return jsonify({'valid': True}), 200
        return jsonify({'valid': False}), 401
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401

@auth_bp.route('/users', methods=['GET'])
def list_users():
    from app import engine  # Import engine inside the function to avoid circular import
    with SqlAlchemySession(engine) as db_session:
        users = db_session.query(User).all()
        users_data = [
            {
                'user_id': user.user_id,
                'username': user.username,
                'email': user.email,
                # password is not included for security reasons
            }
            for user in users
        ]
    return jsonify(users_data)

@auth_bp.route('/register', methods=['POST'])
def register():
    from app import engine, app  # import app for secret_key
    data = request.get_json() or {}

    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    if not username or not email or not password:
        return jsonify({'error': 'Missing username, email, or password'}), 400

    hashed_password = generate_password_hash(password)

    with SqlAlchemySession(engine) as db_session:
        existing_user = db_session.query(User).filter(
            (User.username == username) | (User.email == email)
        ).first()
        if existing_user:
            return jsonify({'error': 'User with that username or email already exists'}), 400

        new_user = User(username=username, email=email, password=hashed_password)
        db_session.add(new_user)
        db_session.commit()

        # Generate JWT token for new user
        token = jwt.encode({'user_id': new_user.user_id}, app.secret_key, algorithm='HS256')

    return jsonify({
        'message': 'User registered successfully',
        'token': token,
        'user_id': new_user.user_id
    }), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    from app import engine, app  # Import engine inside the function to avoid circular import
    data = request.get_json() or {}

    # Add a log to see the received data
    print("Received login data:", data)

    username_or_email = data.get('username')
    password = data.get('password')

    if not username_or_email or not password:
        return jsonify({'error': 'Missing username/email or password'}), 400

    with SqlAlchemySession(engine) as db_session:
        user = db_session.query(User).filter(
            (User.username == username_or_email) | (User.email == username_or_email)
        ).first()

        if user and check_password_hash(user.password, password):
            # Generate JWT token and send it back in the response
            token = jwt.encode(
                {'user_id': user.user_id}, app.secret_key, algorithm='HS256'
            )
            # Log the response being sent to the client
            print(f"Login successful. Sending token and user_id: {token}, {user.user_id}")
            return jsonify({'message': 'Login successful', 'token': token, 'user_id': user.user_id}), 200

    print("Invalid credentials or user not found")
    print(f"Login successful for user_id: {user.user_id}")
    return jsonify({'error': 'Invalid credentials'}), 401

@auth_bp.route('/logout', methods=['POST'])
def logout():
    from app import app  # Import app here to avoid circular import
    
    # Get the token from the Authorization header
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'error': 'Token is missing'}), 400

    # Strip the 'Bearer ' prefix if it exists
    token = token.replace('Bearer ', '', 1)
    
    print(f"Received token: {token}")  # Debug: Log the token

    try:
        # If using JWT, decode it to validate and get user info
        decoded_token = jwt.decode(token, app.secret_key, algorithms=['HS256'])
        user_id = decoded_token.get('user_id')

        if not user_id:
            return jsonify({'error': 'Invalid token: User ID not found'}), 401
        
        # Do something with user_id if needed (e.g., remove from session)
        session.pop('user_id', None)  # Optionally clear the session

        return jsonify({'message': 'Logout successful'}), 200
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401
    except Exception as e:
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500

# Admin related code - deleting all users
@auth_bp.route('/delete-all-users', methods=['POST'])
def delete_all_users():
    from app import engine  # Prevent circular import
    with SqlAlchemySession(engine) as db_session:
        deleted = db_session.query(User).delete()
        db_session.commit()
    return jsonify({'message': f'{deleted} user(s) deleted.'}), 200