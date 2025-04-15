# ZChat - Realtime Chat & Video Call Application

ZChat is a feature-rich communication application built with Django REST Framework and React.js that enables users to chat in real-time and make video calls with other users.

## Features

- **User Authentication**: Secure login and registration system using JWT
- **Real-time Messaging**: Instant chat functionality using Django Channels and WebSockets
- **Video Calling**: Peer-to-peer video calls implemented with WebRTC
- **User Profiles**: Customizable user profiles with profile images
- **Message Persistence**: All messages are stored in a PostgreSQL database
- **Responsive Design**: Works seamlessly across desktop and mobile devices

## Technology Stack

### Backend
- Django 5.1.7
- Django REST Framework
- Django Channels
- PostgreSQL
- Redis (for WebSocket message caching)
- SimpleJWT for authentication

### Frontend
- React.js
- Vite
- React Context API for state management
- WebRTC for video calling

## Installation Guide

### Prerequisites
- Python 3.8+
- Node.js 16+
- PostgreSQL
- Redis

### Step 1: Clone the Repository

```bash
git clone https://github.com/amrazz/z-chat.git
cd z-chat
```

### Step 2: Set Up Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   ```

3. Activate the virtual environment:
   - On Windows:
     ```bash
     venv\Scripts\activate
     ```
   - On macOS/Linux:
     ```bash
     source venv/bin/activate
     ```

4. Install required packages:
   ```bash
   cd zchat
   pip install -r requirements.txt
   ```

5. Create a `.env` file in the `zchat` directory with the following content:
   ```
   SECRET_KEY="django-insecure-tk2&%)ki5j9-s$s_pc!su_8^8yjahwx8w2!v-1e9dns&j=nz*t"
   DATABASE_NAME="zchat"
   DATABASE_USER="postgres"
   DATABASE_PASSWORD="amraz"
   DATABASE_HOST="localhost"
   DATABASE_PORT=5432
   ```

6. Set up the PostgreSQL database:
   ```bash
   # Create the database
   createdb zchat  # Run this if your PostgreSQL is configured with your user
   
   # Or login to PostgreSQL and create the database
   psql -U postgres
   CREATE DATABASE zchat;
   \q
   ```

7. Apply migrations:
   ```bash
   python manage.py migrate
   ```

8. Create a superuser:
   ```bash
   python manage.py createsuperuser
   ```

9. Start the Redis server:
   ```bash
   redis-server
   ```

10. Run the development server:
    ```bash
    python manage.py runserver
    ```

### Step 3: Set Up Frontend

1. Navigate to the frontend directory:
   ```bash
   cd ../../frontend/zchat
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. The application should now be running at:
   - Backend: http://localhost:8000
   - Frontend: http://localhost:5173

## Usage

1. Register a new account or log in with your credentials.
2. Browse the list of users available for chatting.
3. Click on a user to start a chat conversation.
4. Use the video call button to initiate a WebRTC video call.

## Configuration Options

### Backend Configuration

You can modify the Django settings in `backend/zchat/zchat/settings.py`:

- Change database settings
- Adjust CORS configuration
- Modify JWT token lifetime
- Update WebSocket and Channels settings

### Frontend Configuration

You can customize the API endpoints in `frontend/zchat/src/api.js`:

- Change API base URL
- Modify WebSocket connection URL

## Deployment

For production deployment, make sure to:

1. Set `DEBUG = False` in Django settings
2. Use a proper web server (Nginx/Apache) with Daphne/ASGI
3. Secure your Redis installation
4. Configure HTTPS for secure WebRTC connections
5. Set up proper environment variables rather than using .env files


## Contact

For any inquiries, please reach out to the project maintainer at amrazrafeek2020@gmail.com

---

*Note: This project is currently under development, with the backend fully tested and the frontend testing pending.*