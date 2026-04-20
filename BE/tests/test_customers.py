def test_list_customers(client):
    response = client.get("/api/customers")

    assert response.status_code == 200
    assert response.json() == []
