from rest_framework.routers import SimpleRouter

from .views import WarehouseLocationViewSet, WarehouseViewSet

router = SimpleRouter()
router.register("warehouses", WarehouseViewSet, basename="warehouse")
router.register("locations", WarehouseLocationViewSet, basename="location")

urlpatterns = router.urls
