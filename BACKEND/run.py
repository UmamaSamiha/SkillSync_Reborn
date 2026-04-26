"""
SkillSync — Application Entry Point
=====================================
Run: python run.py   OR   flask run
"""

import click
from app import create_app, db

app = create_app()


@app.cli.command("seed")
def seed():
    """Seed the database with sample data."""
    from app.seed import seed_all
    with app.app_context():
        seed_all()


@app.cli.command("create-db")
def create_db():
    """Create all database tables."""
    with app.app_context():
        db.create_all()
        click.echo("✅ Database tables created.")


@app.cli.command("drop-db")
def drop_db():
    """Drop all database tables (DANGER)."""
    if click.confirm("⚠️  This will delete ALL data. Continue?"):
        with app.app_context():
            db.drop_all()
            click.echo("🗑️  All tables dropped.")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)