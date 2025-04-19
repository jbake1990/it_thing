#!/bin/bash

# Get the absolute path of the virtual environment
VENV_PATH="$(pwd)/venv"

# Run the Flask application with sudo while preserving the virtual environment
sudo -E env "PATH=$PATH" "$VENV_PATH/bin/python" app.py 