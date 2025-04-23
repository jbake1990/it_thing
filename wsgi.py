from app import app, db

# Initialize database
with app.app_context():
    try:
        db.create_all()
    except Exception as e:
        print(f"Error creating database tables: {e}")

if __name__ == "__main__":
    app.run() 