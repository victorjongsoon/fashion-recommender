# Frontend Testing Guide

## ✅ Your Files Are Correct!

You copied the Figma files correctly. The structure is:
- `package.json` - Dependencies and build scripts
- `vite.config.ts` - Vite configuration for building
- `src/` - React components and styles
- `index.html` - Entry point
- Built files go to `dist/` folder

## Local Testing (Development)

### Option 1: Run Locally with Vite
```bash
cd frontend
npm install
npm run dev
```
- Access at: `http://localhost:5173/`
- Auto-reloads on file changes
- Great for development

### Option 2: Build and Serve Locally
```bash
cd frontend
npm run build
npx serve -s dist -l 5173
```
- Access at: `http://localhost:5173/`
- Tests the production build

## Docker Testing

### Build Docker Image
```bash
docker build -f frontend/Dockerfile -t fashion-recommender-frontend .
```

### Run Frontend Container Alone
```bash
docker run -p 5173:5173 fashion-recommender-frontend
```
- Access at: `http://localhost:5173/`

### Run Full Stack with Docker Compose
```bash
docker compose up --build
```
Services will be available at:
- Frontend: `http://localhost:5173/`
- Image Service: `http://localhost:8001/`
- Database: `localhost:5432`
- Agent Service: `http://localhost:8000/` (when implemented)

## Network Access Testing

### Test from Another Machine on Same Network
1. Get your machine's IP:
   ```bash
   # Windows
   ipconfig
   # Look for IPv4 Address
   
   # Linux/Mac
   ifconfig
   ```

2. Access frontend from another computer:
   - `http://<YOUR_IP>:5173/`
   - `http://<YOUR_MACHINE_NAME>:5173/`

### Docker on Network
To make Docker expose on all interfaces:
```bash
docker run -p 0.0.0.0:5173:5173 fashion-recommender-frontend
```

Update `docker-compose.yml`:
```yaml
frontend:
  build:
    context: ./frontend
  ports:
    - "0.0.0.0:5173:5173"
```

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 5173
# Windows:
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Linux/Mac:
lsof -i :5173
kill -9 <PID>
```

### Can't Access from Other Machine
1. Ensure firewall allows port 5173
2. Check if backend services are running
3. Verify network connectivity: `ping <YOUR_IP>`

### Docker Container Won't Start
```bash
docker logs <container_id>
```

## Current Status

✅ Frontend files copied correctly  
✅ Builds successfully  
✅ Dockerfile created  
✅ Docker Compose configured  
✅ Ready for production deployment

**Next Steps:**
1. Test locally: `npm run dev`
2. Test Docker: `docker compose up --build`
3. Deploy to production server and access via IP
