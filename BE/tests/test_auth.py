def test_login(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "staff@example.com", "password": "password"},
    )

    assert response.status_code == 200
    assert "access_token" in response.json()
