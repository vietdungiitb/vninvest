from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AgentRegistry
from .serializers import AgentRegistrySerializer


def _is_staff(user):
    return bool(user and (user.is_staff or user.is_superuser))


def _can_manage(agent, user):
    if _is_staff(user):
        return True
    return agent.created_by_id == user.id


class AgentRegistryListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        agents = AgentRegistry.objects.all()
        if not _is_staff(request.user):
            agents = agents.filter(created_by=request.user)
        agent_type = request.query_params.get('agent_type', '').strip()
        if agent_type:
            agents = agents.filter(agent_type=agent_type)
        is_active = request.query_params.get('is_active', '').strip()
        if is_active in ('true', 'false'):
            agents = agents.filter(is_active=is_active == 'true')
        serializer = AgentRegistrySerializer(agents, many=True)
        return Response({'results': serializer.data})

    def post(self, request):
        serializer = AgentRegistrySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save(created_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class AgentRegistryDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self, pk):
        try:
            return AgentRegistry.objects.get(pk=pk)
        except AgentRegistry.DoesNotExist:
            return None

    def get(self, request, pk):
        agent = self.get_object(pk)
        if not agent:
            return Response({'detail': 'Agent not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not _can_manage(agent, request.user):
            return Response({'detail': 'Agent not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = AgentRegistrySerializer(agent)
        return Response(serializer.data)

    def patch(self, request, pk):
        agent = self.get_object(pk)
        if not agent:
            return Response({'detail': 'Agent not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not _can_manage(agent, request.user):
            return Response({'detail': 'Bạn không có quyền sửa agent này.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = AgentRegistrySerializer(agent, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        agent = self.get_object(pk)
        if not agent:
            return Response({'detail': 'Agent not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not _can_manage(agent, request.user):
            return Response({'detail': 'Bạn không có quyền xóa agent này.'}, status=status.HTTP_403_FORBIDDEN)
        agent.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
