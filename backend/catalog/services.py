from .models import UnitOfMeasure


DEFAULT_UNITS = (
    ("Pieces", "pcs"),
    ("Kilograms", "kg"),
    ("Boxes", "box"),
    ("Liters", "liter"),
)


class CatalogSeedService:
    @staticmethod
    def seed_default_units(workspace):
        units = [
            UnitOfMeasure(
                workspace=workspace,
                name=name,
                abbreviation=abbreviation,
            )
            for name, abbreviation in DEFAULT_UNITS
        ]
        UnitOfMeasure.objects.bulk_create(units, ignore_conflicts=True)
