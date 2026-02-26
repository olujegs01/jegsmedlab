#!/bin/bash
# MedLab AI — Start both backend and frontend

ROOT="$HOME/med-lab-ai"

echo "Starting MedLab AI..."

# Backend
echo "Starting backend on :8000"
cd "$ROOT/backend"
source venv/bin/activate
python main.py &
BACKEND_PID=$!

# Frontend
echo "Starting frontend on :3000"
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "MedLab AI is running!"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:8000"
echo "  API docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both servers."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
