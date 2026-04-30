from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from services.rag_service import RAGService
from services.insights_service import InsightsService

app = FastAPI(title="AI Memory Clone API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

rag = RAGService()
insights = InsightsService(rag)


class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"


class TextUpload(BaseModel):
    content: str
    title: str = "Untitled Note"


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/upload/text")
async def upload_text(data: TextUpload):
    try:
        result = await rag.add_text(data.content, {"title": data.title, "type": "text"})
        return {"success": True, "chunks": result["chunks"], "message": f"Added '{data.title}' to memory"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/upload/pdf")
async def upload_pdf(file: UploadFile = File(...)):
    try:
        if not file.filename.endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files allowed")
        content = await file.read()
        result = await rag.add_pdf(content, file.filename)
        return {"success": True, "chunks": result["chunks"], "message": f"Processed '{file.filename}'"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat")
async def chat(req: ChatRequest):
    try:
        response = await rag.chat(req.message, req.session_id)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/memories")
async def get_memories():
    try:
        return rag.get_all_memories()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze")
async def analyze_brain():
    try:
        result = await insights.analyze()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/graph")
async def get_graph():
    try:
        return rag.get_knowledge_graph()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/memories/clear")
async def clear_memories():
    try:
        rag.clear_all()
        return {"success": True, "message": "All memories cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
