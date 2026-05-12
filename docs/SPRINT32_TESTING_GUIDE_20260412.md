# SPRINT 32: Testing Guide

**Auto-Generated:** 2026-04-12  
**Framework:** pytest + Django Test + DRF test framework

---

## 📋 Test Strategy

### Test Pyramid

```
        ⬜ E2E Tests (1-2  hours)
       ⬜⬜⬜ Integration Tests (4 hours)
   ⬜⬜⬜⬜⬜⬜ Unit Tests (3 hours)
```

### Coverage Target: **95%+ code coverage**

---

## 1️⃣ Unit Tests (Week 1 Friday)

### Test File: `backend/portfolio/tests/test_runtime_vnbroker_config.py`

#### 1.1 Model Tests

```python
import pytest
from portfolio.models import RuntimeVnbrokerConfig
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError

class TestRuntimeVnbrokerConfigModel:
    """Test RuntimeVnbrokerConfig model."""
    
    @pytest.mark.django_db
    def test_singleton_pattern_creates_once(self):
        """Singleton pk=1 created, not duplicated."""
        config1 = RuntimeVnbrokerConfig.get_or_create_singleton()
        config2 = RuntimeVnbrokerConfig.get_or_create_singleton()
        
        assert config1.pk == 1
        assert config2.pk == 1
        assert RuntimeVnbrokerConfig.objects.count() == 1
    
    @pytest.mark.django_db
    def test_default_values_on_creation(self):
        """Singleton initialized with correct defaults."""
        config = RuntimeVnbrokerConfig.get_or_create_singleton()
        
        assert config.max_concurrency == 12
        assert config.retry_attempts == 1
        assert config.retry_backoff_seconds == 0.35
        assert config.rate_limit_cooldown_seconds == 20
        assert config.enable_caching == True
        assert config.price_board_source == "price_board"
        assert isinstance(config.timeout_config, dict)
        assert config.timeout_config['price_board'] == 8
    
    @pytest.mark.django_db
    def test_record_change_appends_changelog(self):
        """record_change() properly logs to changelog."""
        config = RuntimeVnbrokerConfig.get_or_create_singleton()
        user = User.objects.create_user('testuser', password='test123')
        
        config.record_change(user, {
            'max_concurrency': {'old': '12', 'new': '20'}
        })
        
        assert len(config.changelog) == 1
        entry = config.changelog[0]
        assert entry['user'] == 'testuser'
        assert 'timestamp' in entry
        assert entry['changes']['max_concurrency']['new'] == '20'
    
    @pytest.mark.django_db
    def test_to_dict_exports_all_fields(self):
        """to_dict() returns JSON-serializable dict."""
        config = RuntimeVnbrokerConfig.get_or_create_singleton()
        config_dict = config.to_dict()
        
        required_keys = {
            'max_concurrency', 'retry_attempts', 'timeout_config',
            'price_board_source', 'enable_caching', 'updated_at'
        }
        assert required_keys.issubset(config_dict.keys())
        assert isinstance(config_dict['updated_at'], str)  # ISO format
```

#### 1.2 Serializer Tests

```python
from portfolio.serializers import RuntimeVnbrokerConfigSerializer
import pytest

class TestRuntimeVnbrokerConfigSerializer:
    """Test serializer validation."""
    
    @pytest.mark.django_db
    def test_valid_serialization(self):
        """Valid config serializes without errors."""
        config = RuntimeVnbrokerConfig.get_or_create_singleton()
        serializer = RuntimeVnbrokerConfigSerializer(config)
        
        assert serializer.data['max_concurrency'] == 12
        assert serializer.data['retry_attempts'] == 1
    
    def test_validate_max_concurrency_range(self):
        """max_concurrency validation rejects out-of-range values."""
        data = {
            'max_concurrency': 100,  # > 50, invalid
            'retry_attempts': 1,
            'retry_backoff_seconds': 0.35,
            'rate_limit_cooldown_seconds': 20,
            'timeout_config': {},
            'enable_caching': True,
        }
        serializer = RuntimeVnbrokerConfigSerializer(data=data, partial=True)
        
        assert not serializer.is_valid()
        assert 'max_concurrency' in serializer.errors
        assert 'between 1 and 50' in str(serializer.errors['max_concurrency'])
    
    def test_validate_timeout_config_must_be_dict(self):
        """timeout_config must be dict, not list/string."""
        data = {
            'timeout_config': ['price_board', 8],  # Invalid: list
        }
        serializer = RuntimeVnbrokerConfigSerializer(data=data, partial=True)
        
        assert not serializer.is_valid()
        assert 'timeout_config' in serializer.errors
    
    def test_validate_timeout_values_positive(self):
        """Timeout values must be positive."""
        data = {
            'timeout_config': {'price_board': -5},  # Invalid: negative
        }
        serializer = RuntimeVnbrokerConfigSerializer(data=data, partial=True)
        
        assert not serializer.is_valid()
        assert 'timeout_config' in serializer.errors
    
    def test_validate_fallback_sources_valid_sources(self):
        """fallback_sources must contain known sources."""
        data = {
            'fallback_sources': ['invalid_source'],
        }
        serializer = RuntimeVnbrokerConfigSerializer(data=data, partial=True)
        
        assert not serializer.is_valid()
        assert 'fallback_sources' in serializer.errors
```

#### **Run unit tests:**

```bash
cd backend
pytest portfolio/tests/test_runtime_vnbroker_config.py -v --cov=portfolio.models --cov=portfolio.serializers --cov-report=term-missing

# Expected: 100% coverage on serializer + model
```

---

## 2️⃣ Integration Tests (Week 2)

### Test File: `backend/portfolio/tests/test_views_vnbroker_config.py`

```python
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth.models import User
from portfolio.models import RuntimeVnbrokerConfig

class TestRuntimeVnbrokerConfigAPI(APITestCase):
    """Integration tests for vnbroker config API."""
    
    def setUp(self):
        self.admin_user = User.objects.create_superuser(
            'admin', 'admin@test.com', 'admin123'
        )
        self.regular_user = User.objects.create_user(
            'regular', 'regular@test.com', 'regular123'
        )
        self.client.force_authenticate(user=self.admin_user)
    
    def test_get_current_returns_200_with_config(self):
        """GET /current/ returns 200 with current config."""
        response = self.client.get('/api/admin-ops/vnbroker-config/current/')
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['max_concurrency'] == 12
        assert 'timeout_config' in response.data
    
    def test_patch_update_config_partial_update(self):
        """PATCH /update_config/ accepts partial updates."""
        data = {'max_concurrency': 20}
        response = self.client.patch(
            '/api/admin-ops/vnbroker-config/update_config/',
            data,
            format='json'
        )
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'success'
        assert response.data['config']['max_concurrency'] == 20
        
        # Verify saved to DB
        config = RuntimeVnbrokerConfig.objects.get(pk=1)
        assert config.max_concurrency == 20
    
    def test_patch_update_records_changelog(self):
        """PATCH /update_config/ records changes in changelog."""
        response = self.client.patch(
            '/api/admin-ops/vnbroker-config/update_config/',
            {'max_concurrency': 25}
        )
        
        config = RuntimeVnbrokerConfig.objects.get(pk=1)
        assert len(config.changelog) == 1
        entry = config.changelog[0]
        assert entry['user'] == 'admin'
        assert entry['changes']['max_concurrency']['new'] == '25'
    
    def test_patch_invalid_data_returns_400(self):
        """PATCH with invalid data returns 400 with errors."""
        response = self.client.patch(
            '/api/admin-ops/vnbroker-config/update_config/',
            {'max_concurrency': 100}  # > 50
        )
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'errors' in response.data
        assert 'max_concurrency' in response.data['errors']
    
    def test_post_reset_to_defaults(self):
        """POST /reset_to_defaults/ resets config + logs reset."""
        # First modify
        config = RuntimeVnbrokerConfig.get_or_create_singleton()
        config.max_concurrency = 30
        config.save()
        
        # Then reset
        response = self.client.post(
            '/api/admin-ops/vnbroker-config/reset_to_defaults/'
        )
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['config']['max_concurrency'] == 12
        
        # Check changelog includes reset
        config.refresh_from_db()
        reset_entry = config.changelog[-1]
        assert reset_entry['changes']['action'] == 'reset_to_defaults'
    
    def test_get_changelog_returns_history(self):
        """GET /changelog/ returns full change history."""
        # Make some changes
        self.client.patch(
            '/api/admin-ops/vnbroker-config/update_config/',
            {'max_concurrency': 20}
        )
        self.client.patch(
            '/api/admin-ops/vnbroker-config/update_config/',
            {'retry_attempts': 2}
        )
        
        # Get changelog
        response = self.client.get(
            '/api/admin-ops/vnbroker-config/changelog/'
        )
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['total_changes'] == 2
        assert len(response.data['changelog']) == 2
    
    def test_401_without_authentication(self):
        """Unauthenticated requests return 401."""
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/admin-ops/vnbroker-config/current/')
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_403_with_non_admin_user(self):
        """Non-admin users get 403."""
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.get('/api/admin-ops/vnbroker-config/current/')
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
```

#### **Run integration tests:**

```bash
pytest portfolio/tests/test_views_vnbroker_config.py -v --cov=portfolio.views --cov-report=term

# Expected: all 10 tests pass
```

---

## 3️⃣ Frontend Component Tests (Week 3)

### Test File: `frontend/src/components/__tests__/VnbrokerConfigPanel.test.jsx`

```javascript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VnbrokerConfigPanel from '../AdminOps/VnbrokerConfigPanel';

// Mock API
jest.mock('../../api/admin-ops', () => ({
  getAdminOpsAPI: {
    default: jest.fn(),
  },
}));

describe('VnbrokerConfigPanel', () => {
  it('loads and displays current configuration', async () => {
    render(<VnbrokerConfigPanel />);
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('12')).toBeInTheDocument();  // max_concurrency
    });
  });
  
  it('updates max_concurrency when form changes', async () => {
    render(<VnbrokerConfigPanel />);
    
    const input = await screen.findByDisplayValue('12');
    await userEvent.clear(input);
    await userEvent.type(input, '20');
    
    expect(input.value).toBe('20');
  });
  
  it('validates invalid concurrency (> 50)', async () => {
    render(<VnbrokerConfigPanel />);
    
    const input = await screen.findByDisplayValue('12');
    await userEvent.clear(input);
    await userEvent.type(input, '100');
    
    // Frontend should show error or disable save
    await waitFor(() => {
      expect(screen.getByText(/must be between 1 and 50/i)).toBeVisible();
    });
  });
  
  it('saves config on button click', async () => {
    const mockSave = jest.fn().mockResolvedValue({ success: true });
    // ... setup mock API
    
    render(<VnbrokerConfigPanel />);
    
    const input = await screen.findByDisplayValue('12');
    await userEvent.clear(input);
    await userEvent.type(input, '20');
    
    const saveBtn = screen.getByRole('button', { name: /Lưu Config/i });
    await userEvent.click(saveBtn);
    
    await waitFor(() => {
      expect(mockSave).toHaveBeenCalled();
    });
  });
  
  it('shows changelog on expand button', async () => {
    render(<VnbrokerConfigPanel />);
    
    const expandBtn = screen.getByRole('button', { name: /Xem/i });
    await userEvent.click(expandBtn);
    
    await waitFor(() => {
      expect(screen.getByText(/admin/)).toBeVisible();  // changelog user
    });
  });
  
  it('resets to defaults on confirmation', async () => {
    render(<VnbrokerConfigPanel />);
    
    const resetBtn = screen.getByRole('button', { name: /Reset Defaults/i });
    
    // Mock confirm
    window.confirm = jest.fn(() => true);
    
    await userEvent.click(resetBtn);
    
    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
    });
  });
});
```

#### **Run component tests:**

```bash
cd frontend
npm test -- VnbrokerConfigPanel.test.jsx --coverage

# Expected: all 6 tests pass
```

---

## 4️⃣ UAT Scenarios (Week 4)

### Scenario S1: Configure policy from AdminOps

**Objective:** Verify config saves and reflects in API

```gherkin
Given:
  - Admin is logged in
  - AdminOps → Vnbroker Config tab is visible
  - Current max_concurrency = 12

When:
  1. Change max_concurrency input to "20"
  2. Click "Lưu Config" button
  3. Wait for success message

Then:
  ✅ Success message appears
  ✅ Form still shows "20"
  ✅ GET /api/admin-ops/vnbroker-config/current/ returns max_concurrency: 20
  ✅ Updated_by = "admin"
  ✅ Changelog has 1 entry
```

**Evidence to collect:**
- [ ] Screenshot of form before save (max_concurrency=12)
- [ ] Screenshot of form after save (max_concurrency=20)
- [ ] API response payload showing max_concurrency=20
- [ ] Changelog snippet showing the change

---

### Scenario S2: Timeout per channel

**Objective:** Verify timeout config per channel takes effect

```gherkin
Given:
  - Current timeout_config = {price_board: 8, intraday: 8, ...}

When:
  1. Update price_board timeout to "12"
  2. Save config
  3. Watch vnbroker logs for next price_board call

Then:
  ✅ Timeout value changes to 12 in timeout_config
  ✅ vnbroker adapter calls price_board with timeout=12s
  ✅ Slow responses (< 12s) no longer timeout
```

**Evidence to collect:**
- [ ] Screenshot of timeout form
- [ ] Backend log showing timeout=12s applied
- [ ] Metrics graph showing no timeout errors after change

---

### Scenario S3: Rate limit adaptive behavior

**Objective:** Verify 429 detection and multiplier work

```gherkin
Given:
  - Current cooldown_multiplier_on_429 = 2.0
  - Current market_open_interval = 35s

When:
  1. Simulate upstream 429 response (e.g., mock vnbroker API)
  2. Monitor prefetch task for next 2 minutes
  3. Watch effective interval adjustments

Then:
  ✅ After 429 detected, interval becomes 35s × 2.0 = 70s
  ✅ Interval doesn't exceed max_interval_seconds (1800s)
  ✅ Metrics show "429 detected" event
```

**Evidence to collect:**
- [ ] Log entry showing "Rate limit detected, multiplying interval"
- [ ] Metrics dashboard showing interval increase
- [ ] Sequence of prefetch task timestamps (verify 70s gap)

---

### Scenario S4: Invalid config prevention

**Objective:** Verify validation works on FE + BE

```gherkin
Given:
  - max_concurrency field is visible

When:
  1. Try to enter "100" (> 50)
  2. Click "Lưu Config"

Then:
  ✅ FE shows validation error or disables button
  ✅ If submitted, BE returns 400 with field error
  ✅ Config NOT saved to database
  ✅ Old value (12) remains in effect
```

**Evidence to collect:**
- [ ] Screenshot of validation error on FE
- [ ] API response with 400 + error message
- [ ] Verify DB still has max_concurrency=12

---

## 5️⃣ Performance Tests

### Request Latency

```bash
# Measure API response time
ab -n 100 -c 10 http://localhost:8000/api/admin-ops/vnbroker-config/current/

# Expected: < 100ms (mostly DB query +GETREASON cache lookup)
```

### Cache Invalidation Speed

```python
# Measure config reload time
import time
from portfolio.models import RuntimeVnbrokerConfig
from portfolio.adapters.vnbroker_adapter import VnbrokerConfigManager

config = RuntimeVnbrokerConfig.get_or_create_singleton()
config.max_concurrency = 30
config.save()

start = time.time()
new_val = VnbrokerConfigManager.get_current_config()['max_concurrency']
elapsed = time.time() - start

print(f"Config change reflected in {elapsed*1000:.2f}ms")
# Expected: < 50ms
```

---

## 6️⃣ Test Checklist

### Unit Tests ✅

- [ ] Model singleton pattern (1 record)
- [ ] Default values on creation
- [ ] Changelog recording
- [ ] to_dict() export
- [ ] Serializer validation (all fields)
- [ ] Invalid value rejection

### Integration Tests ✅

- [ ] GET /current/ returns 200
- [ ] GET /current/ returns all fields
- [ ] PATCH /update_config/ partial update works
- [ ] PATCH /update_config/ invalid data returns 400
- [ ] PATCH /update_config/ records changelog
- [ ] POST /reset_to_defaults/ works
- [ ] GET /changelog/ returns history
- [ ] 401 without auth
- [ ] 403 for non-admin
- [ ] Multiple concurrent PATCH requests handle correctly

### Frontend Tests ✅

- [ ] Component loads (renders tab)
- [ ] API call on mount (GET /current/)
- [ ] Form inputs update state
- [ ] Save button calls API (PATCH)
- [ ] Reset button works with confirmation
- [ ] Changelog expands/collapses
- [ ] Validation messages display
- [ ] Error handling (show toast)
- [ ] Loading states (spinners)

### UAT Scenarios ✅

- [ ] S1: Configure policy from AdminOps (full flow)
- [ ] S2: Timeout per channel (effect verified)
- [ ] S3: 429 adaptive behavior (multiplier works)
- [ ] S4: Invalid config prevention (validation works)

### Performance ✅

- [ ] API response < 100ms
- [ ] Config change reflected < 50ms
- [ ] Cache TTL 5 minutes working
- [ ] No N+1 queries

---

## Running All Tests

```bash
# Unit + Integration tests
cd backend
pytest portfolio/tests/test_runtime_vnbroker_config.py \
        portfolio/tests/test_views_vnbroker_config.py \
        -v --cov=portfolio --cov-report=html

# Frontend tests
cd frontend
npm test -- VnbrokerConfigPanel.test.jsx --coverage

# Expected: 95%+ coverage, 100% test pass rate
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-04-12

