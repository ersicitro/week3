from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BillViewSet, call_deepseek, analyze_text_view

router = DefaultRouter()
router.register(r'bills', BillViewSet, basename='bill')

urlpatterns = [
    path('', include(router.urls)),
    path('deepseek/', call_deepseek, name='call_deepseek'),
    path('analyze/', analyze_text_view, name='analyze_text'),
] 