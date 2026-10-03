import re

with open('c:/Mujoco Projects/vninvest/packages/core/backend/src/vninvest_core/compat_views.py', 'r', encoding='utf-8') as f:
    content = f.read()

header = content[:content.find('\nclass ')]

def get_classes(class_names):
    result = []
    for name in class_names:
        # Regex to match the class block until the next 'class ' or end of file
        # Handle decorators if any, but in our case they don't have decorators or they do?
        # compat_views.py classes usually start with 'class '
        pattern = r'(\nclass ' + name + r'\(.*?\n(?=\nclass |\Z))'
        match = re.search(pattern, content, flags=re.DOTALL)
        if match:
            result.append(match.group(1))
        else:
            print(f"Warning: class {name} not found")
    return '\n'.join(result)

# user_workspace
uw_classes = ['LegacyWatchlistGroupDetailView', 'LegacyWatchlistGroupListView', 'LegacyWatchlistItemCreateView', 'LegacyWatchlistItemDeleteView', 'PortfolioAnalyticsStubView', 'PortfolioListAnalyticsStubView', 'PortfolioUserConfigView']
uw_content = header + '\n' + get_classes(uw_classes) + '\n'
with open('c:/Mujoco Projects/vninvest/packages/core/backend/src/user_workspace/legacy_views.py', 'w', encoding='utf-8') as f:
    f.write(uw_content)

# market_data
md_classes = ['StockManagementGroupsView', 'StockManagementSeedView', 'StockManagementSyncView', 'StockManagementLegacyBridgeView', 'TrackedSymbolsView', 'TrackedSymbolDetailView', 'TrackedSymbolBulkThresholdView', 'PriceAlertsView', 'PriceAlertDetailView', 'PriceAlertTriggerView']
md_content = header + '\n' + get_classes(md_classes) + '\n'
with open('c:/Mujoco Projects/vninvest/packages/core/backend/src/market_data/legacy_views.py', 'w', encoding='utf-8') as f:
    f.write(md_content)

# market_serving
ms_classes = ['RealtimeLegacyBridgeView', 'RealtimeWhaleFeedAggregateView', 'RealtimeWhaleCampaignsView', 'RealtimeUnifiedAlertsView']
ms_content = header + '\n' + get_classes(ms_classes) + '\n'
with open('c:/Mujoco Projects/vninvest/packages/core/backend/src/market_serving/legacy_views.py', 'w', encoding='utf-8') as f:
    f.write(ms_content)

# vninvest_core/utils/legacy_stubs.py
core_classes = ['GenericEmptyListView', 'GenericEmptyStaffView']
core_content = header + '\n' + get_classes(core_classes) + '\n'
with open('c:/Mujoco Projects/vninvest/packages/core/backend/src/vninvest_core/utils/legacy_stubs.py', 'w', encoding='utf-8') as f:
    f.write(core_content)

print("Split completed successfully")
