def test_analysis(client):
    response = client.post(
        "/api/analysis",
        json={"image_url": "https://example.com/image.jpg"},
    )

    assert response.status_code == 200
    assert "recommendations" in response.json()
