#!/bin/bash
# JegsMedLab — One-command setup script

set -e

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║        JegsMedLab — Setup Script        ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Check Python
if ! command -v python3 &>/dev/null; then
  echo "❌ Python 3 not found. Install from python.org"
  exit 1
fi

# Check Node
if ! command -v node &>/dev/null; then
  echo "❌ Node.js not found. Install from nodejs.org"
  exit 1
fi

# Check npm/bun
PKG_MGR="npm"
if command -v bun &>/dev/null; then
  PKG_MGR="bun"
  echo "✓ Using bun for frontend"
else
  echo "✓ Using npm for frontend"
fi

echo ""
echo "── Backend Setup ──"
cd backend

# Create .env if missing
if [ ! -f .env ]; then
  cp .env.example .env
  echo "📝 Created backend/.env — please add your ANTHROPIC_API_KEY"
fi

# Create virtual environment
if [ ! -d venv ]; then
  echo "🐍 Creating Python virtual environment..."
  python3 -m venv venv
fi

echo "📦 Installing Python dependencies..."
source venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt

echo "✓ Backend dependencies installed"
cd ..

echo ""
echo "── Frontend Setup ──"
cd frontend

echo "📦 Installing Node dependencies..."
if [ "$PKG_MGR" = "bun" ]; then
  bun install --quiet
else
  npm install --quiet
fi

echo "✓ Frontend dependencies installed"
cd ..

echo ""
echo "══════════════════════════════════════════"
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo ""
echo "  1. Add your Anthropic API key:"
echo "     Edit backend/.env and set ANTHROPIC_API_KEY=sk-ant-..."
echo ""
echo "  2. Start the backend (new terminal):"
echo "     cd backend && source venv/bin/activate && python main.py"
echo ""
echo "  3. Start the frontend (new terminal):"
echo "     cd frontend && $PKG_MGR run dev"
echo ""
echo "  4. Open http://localhost:3000"
echo "══════════════════════════════════════════"
