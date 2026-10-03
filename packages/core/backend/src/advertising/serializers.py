from rest_framework import serializers
from advertising.models import AdCampaign, AdDailySummary


class AdCampaignSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdCampaign
        fields = '__all__'


class AdDailySummarySerializer(serializers.ModelSerializer):
    campaign_name = serializers.ReadOnlyField(source='campaign.name')

    class Meta:
        model = AdDailySummary
        fields = '__all__'
