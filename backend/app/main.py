from fastapi import FastAPI 
from app.routes.traffic import router as traffic_router
from app.routes.proxy import router as proxy_router


app = FastAPI()
app.include_router(traffic_router)
app.include_router(proxy_router)
@app.get("/")
def home():
    return {"message": "Cyber Intercept backend is running!"}