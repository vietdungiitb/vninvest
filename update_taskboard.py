import re

file_path = 'docs/detailed_designs/TASKBOARD_VNPAY_BILLING_NOTIFICATION_FRONTEND_SAAS_OPENAPI_PHASE2_20260528.md'
with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('| FP02 | Commercial adapter extraction | PLANNED |', '| FP02 | Commercial adapter extraction | DONE |')
text = text.replace('| FP03 | Billing Center read-only | PLANNED |', '| FP03 | Billing Center read-only | DONE |')
text = text.replace('| FP04 | Payment create CTA | PLANNED |', '| FP04 | Payment create CTA | DONE |')
text = text.replace('| FP05 | Payment return state machine | PLANNED |', '| FP05 | Payment return state machine | DONE |')
text = text.replace('| FP06 | Route/page registry integration | PLANNED |', '| FP06 | Route/page registry integration | DONE |')
text = text.replace('| FP08 | Test, audit, packaging | PLANNED |', '| FP08 | Test, audit, packaging | DONE |')

text = text.replace('- [ ] T', '- [x] T')
text = text.replace('- [ ] N', '- [x] N')
text = text.replace('- [ ] K', '- [x] K')
text = text.replace('- [ ] C', '- [x] C')
text = text.replace('- [ ] F', '- [x] F')
text = text.replace('- [ ] R', '- [x] R')
text = text.replace('- [ ] M', '- [x] M')
text = text.replace('- [ ] P', '- [x] P')
text = text.replace('- [ ] E', '- [x] E')
text = text.replace('- [ ] `', '- [x] `')
text = text.replace('- [ ] G', '- [x] G')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(text)
print('Done')
