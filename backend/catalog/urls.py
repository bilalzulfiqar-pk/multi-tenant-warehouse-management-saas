from rest_framework.routers import SimpleRouter

from .views import ProductCategoryViewSet, ProductViewSet, UnitOfMeasureViewSet

router = SimpleRouter()
router.register("categories", ProductCategoryViewSet, basename="category")
router.register("units", UnitOfMeasureViewSet, basename="unit")
router.register("products", ProductViewSet, basename="product")

urlpatterns = router.urls
