from app import app, db

with app.app_context():
    # Drop all tables
    db.drop_all()
    print("Dropped all tables.")
    
    # Create all tables with new schema
    db.create_all()
    print("Created new tables with updated schema.") 