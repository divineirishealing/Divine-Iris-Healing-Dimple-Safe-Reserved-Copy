"""
Test iteration 59: Client Garden CRM APIs
Tests: sync, list, filter, search, stats, update, delete, export CSV
"""
import os
import sys
from pathlib import Path

import pytest
import requests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from utils.garden_labels import (  # noqa: E402
    CANONICAL_LABEL_SET,
    LABEL_ROOT,
    label_filter_variants,
    normalize_label,
)

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestClientsStats:
    """Test client stats endpoint"""
    
    def test_get_stats_success(self):
        """GET /api/clients/stats returns 200 with total and by_label"""
        response = requests.get(f"{BASE_URL}/api/clients/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "total" in data, "Missing 'total' field"
        assert "by_label" in data, "Missing 'by_label' field"
        assert isinstance(data["total"], int), "total should be int"
        assert isinstance(data["by_label"], dict), "by_label should be dict"
        print(f"Stats: total={data['total']}, by_label={data['by_label']}")

    def test_stats_has_label_counts(self):
        """Stats by_label contains expected label names"""
        response = requests.get(f"{BASE_URL}/api/clients/stats")
        data = response.json()
        for label in data["by_label"].keys():
            if label is None:
                continue
            assert (
                label in CANONICAL_LABEL_SET or normalize_label(label) in CANONICAL_LABEL_SET
            ), f"Unknown label: {label}"


class TestClientsList:
    """Test client list and filter endpoints"""
    
    def test_get_clients_success(self):
        """GET /api/clients returns 200 with list"""
        response = requests.get(f"{BASE_URL}/api/clients")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Total clients returned: {len(data)}")
        
    def test_client_has_required_fields(self):
        """Each client should have id, email, label, sources, conversions, timeline"""
        response = requests.get(f"{BASE_URL}/api/clients")
        data = response.json()
        if len(data) > 0:
            cl = data[0]
            required = ["id", "email", "label", "sources", "conversions", "timeline"]
            for field in required:
                assert field in cl, f"Missing field: {field}"
            print(f"Sample client: name={cl.get('name')}, email={cl.get('email')}, label={cl.get('label')}")
        else:
            pytest.skip("No clients found to test fields")

    def test_filter_by_label_dew(self):
        """GET /api/clients?label=Dew filters correctly"""
        response = requests.get(f"{BASE_URL}/api/clients", params={"label": "Dew"})
        assert response.status_code == 200
        data = response.json()
        variants = set(label_filter_variants("Dew"))
        for cl in data:
            assert cl["label"] in variants, f"Expected Dew family label, got {cl['label']}"
        print(f"Dew clients count: {len(data)}")

    def test_filter_by_label_seed(self):
        """GET /api/clients?label=Seed filters correctly"""
        response = requests.get(f"{BASE_URL}/api/clients", params={"label": "Seed"})
        assert response.status_code == 200
        data = response.json()
        variants = set(label_filter_variants("Seed"))
        for cl in data:
            assert cl["label"] in variants, f"Expected Seed family label, got {cl['label']}"
        print(f"Seed clients count: {len(data)}")

    def test_filter_by_label_bloom(self):
        """GET /api/clients?label=Bloom filters correctly"""
        response = requests.get(f"{BASE_URL}/api/clients", params={"label": "Bloom"})
        assert response.status_code == 200
        data = response.json()
        variants = set(label_filter_variants("Bloom"))
        for cl in data:
            assert cl["label"] in variants, f"Expected Bloom family label, got {cl['label']}"
        print(f"Bloom clients count: {len(data)}")

    def test_search_by_name(self):
        """GET /api/clients?search=test searches by name"""
        # First get a sample client name
        response = requests.get(f"{BASE_URL}/api/clients")
        clients = response.json()
        if len(clients) == 0:
            pytest.skip("No clients to search")
        # Get first client with name
        sample = next((c for c in clients if c.get("name")), None)
        if sample is None:
            pytest.skip("No clients with name to search")
        
        # Search with partial name
        search_term = sample["name"][:3] if len(sample["name"]) >= 3 else sample["name"]
        response = requests.get(f"{BASE_URL}/api/clients", params={"search": search_term})
        assert response.status_code == 200
        data = response.json()
        assert len(data) > 0, f"Expected results for search '{search_term}'"
        print(f"Search '{search_term}' returned {len(data)} results")

    def test_search_by_email(self):
        """GET /api/clients?search=email searches by email"""
        response = requests.get(f"{BASE_URL}/api/clients")
        clients = response.json()
        if len(clients) == 0:
            pytest.skip("No clients to search")
        sample = clients[0]
        
        # Search with partial email (domain)
        search_term = sample["email"].split("@")[-1] if "@" in sample["email"] else sample["email"][:5]
        response = requests.get(f"{BASE_URL}/api/clients", params={"search": search_term})
        assert response.status_code == 200
        data = response.json()
        assert len(data) > 0, f"Expected results for search '{search_term}'"
        print(f"Search by email '{search_term}' returned {len(data)} results")


class TestClientSync:
    """Test client sync endpoint"""
    
    def test_sync_endpoint_success(self):
        """POST /api/clients/sync returns 200 with stats"""
        response = requests.post(f"{BASE_URL}/api/clients/sync")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "message" in data, "Missing 'message' field"
        assert "stats" in data, "Missing 'stats' field"
        stats = data["stats"]
        assert "new_clients" in stats, "Missing new_clients in stats"
        assert "updated" in stats, "Missing updated in stats"
        print(f"Sync: {stats}")


class TestClientUpdateDelete:
    """Test client update and delete endpoints"""
    
    def test_update_client_notes(self):
        """PUT /api/clients/{id} updates notes"""
        # Get a client
        response = requests.get(f"{BASE_URL}/api/clients")
        clients = response.json()
        if len(clients) == 0:
            pytest.skip("No clients to update")
        
        cl = clients[0]
        client_id = cl["id"]
        original_notes = cl.get("notes", "")
        
        # Update notes
        test_note = "Test note from iteration 59 pytest"
        response = requests.put(f"{BASE_URL}/api/clients/{client_id}", json={"notes": test_note})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Verify update
        response = requests.get(f"{BASE_URL}/api/clients/{client_id}")
        assert response.status_code == 200
        updated = response.json()
        assert updated["notes"] == test_note, f"Notes not updated correctly"
        print(f"Updated notes for client {client_id}")
        
        # Restore original notes
        requests.put(f"{BASE_URL}/api/clients/{client_id}", json={"notes": original_notes})

    def test_update_client_label_manual(self):
        """PUT /api/clients/{id} can set label_manual override"""
        response = requests.get(f"{BASE_URL}/api/clients")
        clients = response.json()
        if len(clients) == 0:
            pytest.skip("No clients to update")
        
        cl = clients[0]
        client_id = cl["id"]
        original_label_manual = cl.get("label_manual", "")
        original_label = cl.get("label", "")
        
        # Set manual label
        response = requests.put(f"{BASE_URL}/api/clients/{client_id}", json={"label_manual": "Root"})
        assert response.status_code == 200
        
        # Verify update
        response = requests.get(f"{BASE_URL}/api/clients/{client_id}")
        updated = response.json()
        assert updated["label_manual"] == LABEL_ROOT, "label_manual not normalized"
        assert updated["label"] == LABEL_ROOT, "label should match manual override"
        print(f"Set manual label 'Root' for client {client_id}")
        
        # Restore - clear manual label
        requests.put(f"{BASE_URL}/api/clients/{client_id}", json={"label_manual": ""})

    def test_update_nonexistent_client_404(self):
        """PUT /api/clients/nonexistent returns 404"""
        response = requests.put(f"{BASE_URL}/api/clients/nonexistent-uuid-12345", json={"notes": "test"})
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"

    def test_get_single_client(self):
        """GET /api/clients/{id} returns client details"""
        response = requests.get(f"{BASE_URL}/api/clients")
        clients = response.json()
        if len(clients) == 0:
            pytest.skip("No clients")
        
        client_id = clients[0]["id"]
        response = requests.get(f"{BASE_URL}/api/clients/{client_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == client_id
        print(f"Got client {client_id}: {data.get('name', 'unknown')}")

    def test_get_nonexistent_client_404(self):
        """GET /api/clients/nonexistent returns 404"""
        response = requests.get(f"{BASE_URL}/api/clients/nonexistent-uuid-12345")
        assert response.status_code == 404

    def test_delete_nonexistent_client_404(self):
        """DELETE /api/clients/nonexistent returns 404"""
        response = requests.delete(f"{BASE_URL}/api/clients/nonexistent-uuid-12345")
        assert response.status_code == 404


class TestClientExport:
    """Test CSV export endpoint"""
    
    def test_export_csv_success(self):
        """GET /api/clients/export/csv returns CSV file"""
        response = requests.get(f"{BASE_URL}/api/clients/export/csv")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert "text/csv" in response.headers.get("content-type", ""), "Expected content-type text/csv"
        content_disposition = response.headers.get("content-disposition", "")
        assert "attachment" in content_disposition, "Expected attachment disposition"
        assert ".csv" in content_disposition, "Expected .csv filename"
        
        # Check CSV content
        csv_content = response.text
        lines = csv_content.strip().split("\n")
        assert len(lines) >= 1, "CSV should have at least header row"
        header = lines[0]
        assert "Label" in header, "CSV should have Label column"
        assert "Email" in header, "CSV should have Email column"
        print(f"CSV export: {len(lines)} rows (including header)")


class TestClientDataValidation:
    """Validate client data structure and content"""
    
    def test_stats_total_matches_list_count(self):
        """Stats total should match clients list count"""
        stats_res = requests.get(f"{BASE_URL}/api/clients/stats")
        clients_res = requests.get(f"{BASE_URL}/api/clients")
        
        stats = stats_res.json()
        clients = clients_res.json()
        
        assert stats["total"] == len(clients), f"Stats total {stats['total']} != clients count {len(clients)}"
        print(f"Total verified: {stats['total']} clients")

    def test_label_counts_match_filtered_counts(self):
        """Stats by_label counts should match filtered list counts"""
        stats_res = requests.get(f"{BASE_URL}/api/clients/stats")
        stats = stats_res.json()
        
        for label, count in stats["by_label"].items():
            filtered_res = requests.get(f"{BASE_URL}/api/clients", params={"label": label})
            filtered = filtered_res.json()
            assert len(filtered) == count, f"Label {label}: stats={count}, filtered={len(filtered)}"
        print("All label counts verified")

    def test_clients_have_valid_labels(self):
        """All clients should have valid labels"""
        valid_labels = ["Dew", "Seed", "Root", "Bloom", "Iris", "Purple Bees", "Iris Bees"]
        response = requests.get(f"{BASE_URL}/api/clients")
        clients = response.json()
        
        for cl in clients:
            assert cl["label"] in valid_labels, f"Invalid label: {cl['label']}"
        print(f"All {len(clients)} clients have valid labels")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
