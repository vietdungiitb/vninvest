import re

file_path = 'c:/Mujoco Projects/vninvest/packages/core/backend/src/market_serving/legacy_views.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# We know the classes are RealtimeLegacyBridgeView, RealtimeWhaleFeedAggregateView, RealtimeWhaleCampaignsView, RealtimeUnifiedAlertsView
# We need to extract them and reorder them.
# RealtimeUnifiedAlertsView is the base class for RealtimeWhaleFeedAggregateView and RealtimeWhaleCampaignsView.
# So the order should be: RealtimeLegacyBridgeView, RealtimeUnifiedAlertsView, RealtimeWhaleFeedAggregateView, RealtimeWhaleCampaignsView

pattern1 = r'(\nclass RealtimeLegacyBridgeView.*?)(?=\nclass RealtimeWhaleFeedAggregateView)'
match1 = re.search(pattern1, content, flags=re.DOTALL)
cls_bridge = match1.group(1) if match1 else ''

pattern2 = r'(\nclass RealtimeWhaleFeedAggregateView.*?)(?=\nclass RealtimeWhaleCampaignsView)'
match2 = re.search(pattern2, content, flags=re.DOTALL)
cls_aggregate = match2.group(1) if match2 else ''

pattern3 = r'(\nclass RealtimeWhaleCampaignsView.*?)(?=\nclass RealtimeUnifiedAlertsView)'
match3 = re.search(pattern3, content, flags=re.DOTALL)
cls_campaigns = match3.group(1) if match3 else ''

pattern4 = r'(\nclass RealtimeUnifiedAlertsView.*)'
match4 = re.search(pattern4, content, flags=re.DOTALL)
cls_unified = match4.group(1) if match4 else ''

header = content[:content.find('\nclass RealtimeLegacyBridgeView')]

new_content = header + cls_bridge + cls_unified + '\n' + cls_aggregate + cls_campaigns
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Reordered successfully.")
