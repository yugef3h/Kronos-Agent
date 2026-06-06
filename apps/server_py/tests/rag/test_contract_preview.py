from app.rag.contract import assert_knowledge_preview_item_contract


def test_preview_contract_validates_chunk_keys():
    item = {
        "fileName": "a.txt",
        "mimeType": "text/plain",
        "totalChunks": 1,
        "preview": [{"id": "c1", "index": 0, "text": "hi", "tokenCount": 1, "charCount": 2}],
    }
    assert_knowledge_preview_item_contract(item)
