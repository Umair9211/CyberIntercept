from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.traffic import router as traffic_router
from app.routes.proxy import router as proxy_router


app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

app.include_router(traffic_router)
app.include_router(proxy_router)

@app.get("/")
def home():
    return {"message": "Cyber Intercept backend is running!"}