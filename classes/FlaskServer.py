# file: classes/FlaskServer.py
from flask import Flask, render_template, request, redirect, url_for

# Initialize Flask app
app = Flask(__name__, 
            static_folder='../static',
            template_folder='../templates')

# Routes
@app.route('/')
def index():
    """Serve the main page"""
    return render_template('index.html')

def run(host='0.0.0.0', port=4242):
    """Run the Flask server"""
    app.run(host=host, port=port, debug=False, threaded=True)