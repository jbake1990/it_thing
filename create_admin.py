from app import app, db, User
from werkzeug.security import generate_password_hash

def create_admin_user(username, password):
    with app.app_context():
        # Check if user already exists
        if User.query.filter_by(username=username).first():
            print(f"User {username} already exists!")
            return
        
        # Create new admin user
        admin = User(
            username=username,
            password_hash=generate_password_hash(password),
            is_admin=True
        )
        
        # Add to database
        db.session.add(admin)
        db.session.commit()
        print(f"Admin user '{username}' created successfully!")

if __name__ == '__main__':
    create_admin_user('admin', 'admin123') 