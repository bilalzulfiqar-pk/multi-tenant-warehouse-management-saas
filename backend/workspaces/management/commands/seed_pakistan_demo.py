from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from catalog.models import Product, ProductCategory, UnitOfMeasure
from catalog.services import CatalogSeedService
from inventory.models import StockMovement
from inventory.services import InventoryService
from warehouse.models import (
    LocationType,
    Warehouse,
    WarehouseLocation,
    WarehouseStatus,
)
from workspaces.models import (
    InviteStatus,
    MembershipStatus,
    Workspace,
    WorkspaceInvite,
    WorkspaceMembership,
    WorkspaceRole,
    WorkspaceStatus,
)
from workspaces.services import WorkspaceService


DEMO_PASSWORD = "PakistanDemo123!"
DEMO_REFERENCE_TYPE = "demo_seed"


DEMO_USERS = (
    ("owner@pakdemo.example.com", "Ayesha Khan", WorkspaceRole.OWNER),
    ("admin@pakdemo.example.com", "Bilal Ahmed", WorkspaceRole.ADMIN),
    ("manager@pakdemo.example.com", "Sana Malik", WorkspaceRole.MANAGER),
    ("staff@pakdemo.example.com", "Omar Farooq", WorkspaceRole.STAFF),
    ("viewer@pakdemo.example.com", "Hira Siddiqui", WorkspaceRole.VIEWER),
)


EXTRA_UNITS = (
    ("Bags", "bag"),
    ("Cartons", "carton"),
    ("Dozens", "dozen"),
    ("Meters", "meter"),
    ("Packs", "pack"),
)


CATEGORIES = (
    ("Grocery and Staples", "Rice, flour, sugar, and pantry staples."),
    ("Beverages", "Tea, juices, and shelf-stable drinks."),
    ("Personal Care", "Daily-use personal care items."),
    ("Electronics Accessories", "Small consumer electronics accessories."),
    ("Textile and Apparel", "Fabric rolls and ready-to-wear stock."),
    ("Household Goods", "General household supplies."),
)


PRODUCTS = (
    {
        "sku": "BAS-RICE-1121",
        "name": "1121 Basmati Rice 5kg Bag",
        "category": "Grocery and Staples",
        "unit": "bag",
        "threshold": "120.000",
        "cost": "1850.00",
    },
    {
        "sku": "BAS-ATTA-10KG",
        "name": "Chakki Atta 10kg Bag",
        "category": "Grocery and Staples",
        "unit": "bag",
        "threshold": "150.000",
        "cost": "1420.00",
    },
    {
        "sku": "BAS-SUGAR-1KG",
        "name": "Refined Sugar 1kg Pack",
        "category": "Grocery and Staples",
        "unit": "pack",
        "threshold": "300.000",
        "cost": "165.00",
    },
    {
        "sku": "BEV-TEA-950",
        "name": "Premium Black Tea 950g Pack",
        "category": "Beverages",
        "unit": "pack",
        "threshold": "150.000",
        "cost": "1750.00",
    },
    {
        "sku": "BEV-JUICE-MANGO",
        "name": "Mango Juice 1L Carton",
        "category": "Beverages",
        "unit": "carton",
        "threshold": "60.000",
        "cost": "280.00",
    },
    {
        "sku": "PC-SOAP-125",
        "name": "Neem Soap 125g Bar",
        "category": "Personal Care",
        "unit": "pcs",
        "threshold": "500.000",
        "cost": "95.00",
    },
    {
        "sku": "HH-DETERGENT-1KG",
        "name": "Laundry Detergent 1kg Pack",
        "category": "Household Goods",
        "unit": "pack",
        "threshold": "180.000",
        "cost": "560.00",
    },
    {
        "sku": "ELEC-CABLE-C1",
        "name": "USB-C Charging Cable",
        "category": "Electronics Accessories",
        "unit": "pcs",
        "threshold": "120.000",
        "cost": "450.00",
    },
    {
        "sku": "ELEC-POWER-20K",
        "name": "Power Bank 20000mAh",
        "category": "Electronics Accessories",
        "unit": "pcs",
        "threshold": "25.000",
        "cost": "5200.00",
    },
    {
        "sku": "TEX-COTTON-ROLL",
        "name": "Cotton Lawn Fabric Roll",
        "category": "Textile and Apparel",
        "unit": "meter",
        "threshold": "300.000",
        "cost": "310.00",
    },
    {
        "sku": "APP-POLO-M",
        "name": "Men Polo Shirt Medium",
        "category": "Textile and Apparel",
        "unit": "pcs",
        "threshold": "80.000",
        "cost": "1450.00",
    },
    {
        "sku": "APP-DUPATTA-CHIFFON",
        "name": "Chiffon Dupatta",
        "category": "Textile and Apparel",
        "unit": "pcs",
        "threshold": "40.000",
        "cost": "900.00",
    },
)


WORKSPACE_DEMOS = (
    {
        "name": "PakMart Distribution",
        "subdomain": "pakmart",
        "invites": (
            ("regional.manager@pakdemo.example.com", WorkspaceRole.MANAGER),
            ("inventory.auditor@pakdemo.example.com", WorkspaceRole.VIEWER),
        ),
        "warehouses": (
            {
                "code": "KHI-MAIN",
                "name": "Karachi Main Distribution Centre",
                "address_line1": "Plot 14, Korangi Industrial Area",
                "address_line2": "Near Vita Chowrangi",
                "city": "Karachi",
                "country": "Pakistan",
                "status": WarehouseStatus.ACTIVE,
                "locations": (
                    ("KHI-A01", "Main Storage Aisle 01", LocationType.STORAGE),
                    ("KHI-FMV", "Fast Moving Goods Zone", LocationType.STORAGE),
                    ("KHI-QH", "Quality Hold Area", LocationType.OTHER),
                ),
            },
            {
                "code": "LHE-NORTH",
                "name": "Lahore North Fulfilment Hub",
                "address_line1": "Sundar Industrial Estate",
                "address_line2": "Raiwind Road",
                "city": "Lahore",
                "country": "Pakistan",
                "status": WarehouseStatus.ACTIVE,
                "locations": (
                    ("LHE-A01", "Main Storage Aisle 01", LocationType.STORAGE),
                    ("LHE-BULK", "Bulk Stock Zone", LocationType.STORAGE),
                ),
            },
            {
                "code": "ISB-COLD",
                "name": "Islamabad Cold Storage Hub",
                "address_line1": "Street 7, I-9 Industrial Area",
                "address_line2": "",
                "city": "Islamabad",
                "country": "Pakistan",
                "status": WarehouseStatus.ACTIVE,
                "locations": (
                    ("ISB-CH1", "Controlled Room 01", LocationType.STORAGE),
                    ("ISB-DRY", "Dry Goods Room", LocationType.STORAGE),
                ),
            },
            {
                "code": "FSD-TEX",
                "name": "Faisalabad Textile Store",
                "address_line1": "M-3 Industrial City",
                "address_line2": "Sahianwala Interchange",
                "city": "Faisalabad",
                "country": "Pakistan",
                "status": WarehouseStatus.ACTIVE,
                "locations": (
                    ("FSD-R01", "Raw Fabric Rack 01", LocationType.STORAGE),
                    ("FSD-F01", "Finished Goods Rack 01", LocationType.STORAGE),
                ),
            },
            {
                "code": "PEW-TRANS",
                "name": "Peshawar Transit Store",
                "address_line1": "Industrial Estate Hayatabad",
                "address_line2": "",
                "city": "Peshawar",
                "country": "Pakistan",
                "status": WarehouseStatus.INACTIVE,
                "locations": (
                    ("PEW-HOLD", "Temporary Holding Area", LocationType.OTHER),
                ),
            },
        ),
        "opening_stock": (
            ("BAS-RICE-1121", "KHI-MAIN", "KHI-A01", "320.000"),
            ("BAS-ATTA-10KG", "KHI-MAIN", "KHI-A01", "280.000"),
            ("BAS-SUGAR-1KG", "LHE-NORTH", "LHE-BULK", "240.000"),
            ("BEV-TEA-950", "KHI-MAIN", "KHI-FMV", "220.000"),
            ("BEV-JUICE-MANGO", "ISB-COLD", "ISB-DRY", "85.000"),
            ("PC-SOAP-125", "LHE-NORTH", "LHE-A01", "600.000"),
            ("HH-DETERGENT-1KG", "KHI-MAIN", "KHI-FMV", "210.000"),
            ("ELEC-CABLE-C1", "KHI-MAIN", "KHI-FMV", "275.000"),
            ("ELEC-POWER-20K", "LHE-NORTH", "LHE-A01", "40.000"),
            ("TEX-COTTON-ROLL", "FSD-TEX", "FSD-R01", "450.000"),
            ("APP-POLO-M", "FSD-TEX", "FSD-F01", "140.000"),
            ("APP-DUPATTA-CHIFFON", "FSD-TEX", "FSD-F01", "75.000"),
        ),
        "stock_outs": (
            (
                "BAS-RICE-1121",
                "KHI-MAIN",
                "KHI-A01",
                "60.000",
                "Retail replenishment",
            ),
            ("PC-SOAP-125", "LHE-NORTH", "LHE-A01", "180.000", "Wholesale order"),
            (
                "ELEC-POWER-20K",
                "LHE-NORTH",
                "LHE-A01",
                "18.000",
                "Marketplace order",
            ),
            ("APP-POLO-M", "FSD-TEX", "FSD-F01", "55.000", "Outlet allocation"),
        ),
        "transfers": (
            (
                "BEV-TEA-950",
                "KHI-MAIN",
                "KHI-FMV",
                "LHE-NORTH",
                "LHE-A01",
                "50.000",
                "Lahore store replenishment",
            ),
            (
                "ELEC-CABLE-C1",
                "KHI-MAIN",
                "KHI-FMV",
                "LHE-NORTH",
                "LHE-A01",
                "75.000",
                "Shift stock closer to Punjab demand",
            ),
        ),
        "adjustments": (
            (
                "ELEC-POWER-20K",
                "LHE-NORTH",
                "LHE-A01",
                "20.000",
                "Cycle count after marketplace returns review",
            ),
            (
                "APP-DUPATTA-CHIFFON",
                "FSD-TEX",
                "FSD-F01",
                "25.000",
                "Physical count after outlet allocation",
            ),
        ),
    },
    {
        "name": "Punjab Traders Wholesale",
        "subdomain": "punjabtraders",
        "invites": (
            ("buyer.punjab@pakdemo.example.com", WorkspaceRole.STAFF),
            ("auditor.punjab@pakdemo.example.com", WorkspaceRole.VIEWER),
        ),
        "warehouses": (
            {
                "code": "LHE-MAIN",
                "name": "Lahore Shah Alam Wholesale Store",
                "address_line1": "Shah Alam Market",
                "address_line2": "Near Circular Road",
                "city": "Lahore",
                "country": "Pakistan",
                "status": WarehouseStatus.ACTIVE,
                "locations": (
                    ("LHE-SH1", "Shah Alam Storage Rack 01", LocationType.STORAGE),
                    ("LHE-BULK", "Wholesale Bulk Zone", LocationType.STORAGE),
                ),
            },
            {
                "code": "MUX-SOUTH",
                "name": "Multan South Depot",
                "address_line1": "Industrial Estate Multan",
                "address_line2": "",
                "city": "Multan",
                "country": "Pakistan",
                "status": WarehouseStatus.ACTIVE,
                "locations": (
                    ("MUX-A01", "Main Storage Aisle 01", LocationType.STORAGE),
                ),
            },
            {
                "code": "RWP-TWIN",
                "name": "Rawalpindi Twin Cities Hub",
                "address_line1": "Saddar Logistics Yard",
                "address_line2": "",
                "city": "Rawalpindi",
                "country": "Pakistan",
                "status": WarehouseStatus.ACTIVE,
                "locations": (
                    ("RWP-A01", "Dispatch Ready Storage", LocationType.STORAGE),
                ),
            },
        ),
        "opening_stock": (
            ("BAS-RICE-1121", "LHE-MAIN", "LHE-SH1", "180.000"),
            ("BAS-ATTA-10KG", "MUX-SOUTH", "MUX-A01", "350.000"),
            ("BEV-TEA-950", "LHE-MAIN", "LHE-BULK", "160.000"),
            ("PC-SOAP-125", "RWP-TWIN", "RWP-A01", "420.000"),
            ("HH-DETERGENT-1KG", "LHE-MAIN", "LHE-BULK", "190.000"),
            ("ELEC-CABLE-C1", "RWP-TWIN", "RWP-A01", "210.000"),
            ("APP-POLO-M", "LHE-MAIN", "LHE-SH1", "90.000"),
        ),
        "stock_outs": (
            ("BAS-ATTA-10KG", "MUX-SOUTH", "MUX-A01", "95.000", "South Punjab order"),
            ("ELEC-CABLE-C1", "RWP-TWIN", "RWP-A01", "60.000", "Twin cities retail order"),
            ("APP-POLO-M", "LHE-MAIN", "LHE-SH1", "35.000", "Liberty Market allocation"),
        ),
        "transfers": (
            (
                "BEV-TEA-950",
                "LHE-MAIN",
                "LHE-BULK",
                "RWP-TWIN",
                "RWP-A01",
                "45.000",
                "Move stock for Islamabad demand",
            ),
        ),
        "adjustments": (
            (
                "PC-SOAP-125",
                "RWP-TWIN",
                "RWP-A01",
                "360.000",
                "Physical count after wholesale pickup",
            ),
        ),
    },
    {
        "name": "Indus Retail Supplies",
        "subdomain": "indussupplies",
        "invites": (
            ("operations.indus@pakdemo.example.com", WorkspaceRole.MANAGER),
            ("viewer.indus@pakdemo.example.com", WorkspaceRole.VIEWER),
        ),
        "warehouses": (
            {
                "code": "KHI-PORT",
                "name": "Karachi Portside Warehouse",
                "address_line1": "West Wharf Road",
                "address_line2": "Keamari",
                "city": "Karachi",
                "country": "Pakistan",
                "status": WarehouseStatus.ACTIVE,
                "locations": (
                    ("KHI-PA", "Portside Storage A", LocationType.STORAGE),
                    ("KHI-FAST", "Fast Dispatch Rack", LocationType.STORAGE),
                ),
            },
            {
                "code": "HYD-CENTRE",
                "name": "Hyderabad Central Store",
                "address_line1": "SITE Area Hyderabad",
                "address_line2": "",
                "city": "Hyderabad",
                "country": "Pakistan",
                "status": WarehouseStatus.ACTIVE,
                "locations": (
                    ("HYD-A01", "Main Storage Aisle 01", LocationType.STORAGE),
                ),
            },
            {
                "code": "QTA-DRY",
                "name": "Quetta Dry Goods Depot",
                "address_line1": "Industrial Estate Eastern Bypass",
                "address_line2": "",
                "city": "Quetta",
                "country": "Pakistan",
                "status": WarehouseStatus.ACTIVE,
                "locations": (
                    ("QTA-A01", "Dry Goods Rack 01", LocationType.STORAGE),
                ),
            },
        ),
        "opening_stock": (
            ("BAS-RICE-1121", "KHI-PORT", "KHI-PA", "260.000"),
            ("BAS-SUGAR-1KG", "HYD-CENTRE", "HYD-A01", "520.000"),
            ("BEV-JUICE-MANGO", "KHI-PORT", "KHI-FAST", "70.000"),
            ("PC-SOAP-125", "HYD-CENTRE", "HYD-A01", "260.000"),
            ("ELEC-POWER-20K", "KHI-PORT", "KHI-FAST", "32.000"),
            ("TEX-COTTON-ROLL", "QTA-DRY", "QTA-A01", "380.000"),
            ("APP-DUPATTA-CHIFFON", "KHI-PORT", "KHI-PA", "65.000"),
        ),
        "stock_outs": (
            ("BEV-JUICE-MANGO", "KHI-PORT", "KHI-FAST", "20.000", "Karachi store order"),
            ("ELEC-POWER-20K", "KHI-PORT", "KHI-FAST", "11.000", "Online sale allocation"),
            ("TEX-COTTON-ROLL", "QTA-DRY", "QTA-A01", "140.000", "Quetta textile order"),
        ),
        "transfers": (
            (
                "BAS-SUGAR-1KG",
                "HYD-CENTRE",
                "HYD-A01",
                "KHI-PORT",
                "KHI-FAST",
                "120.000",
                "Move sugar closer to Karachi demand",
            ),
        ),
        "adjustments": (
            (
                "APP-DUPATTA-CHIFFON",
                "KHI-PORT",
                "KHI-PA",
                "35.000",
                "Physical count after Eid campaign allocation",
            ),
        ),
    },
)


class Command(BaseCommand):
    help = "Seed Pakistan-region demo data for local exploration and frontend testing."

    def add_arguments(self, parser):
        parser.add_argument(
            "--password",
            default=DEMO_PASSWORD,
            help="Password to set for all demo users.",
        )
        parser.add_argument(
            "--skip-stock",
            action="store_true",
            help="Create users/setup data only, without stock movements.",
        )

    def handle(self, *args, **options):
        self.password = options["password"]
        self.skip_stock = options["skip_stock"]
        users = self.create_users()
        owner = users[WorkspaceRole.OWNER]
        summaries = []

        for demo in WORKSPACE_DEMOS:
            summaries.append(self.seed_workspace_demo(demo, users, owner))

        self.write_summary(users, summaries)

    def create_users(self):
        User = get_user_model()
        users = {}
        for email, full_name, role in DEMO_USERS:
            user, _ = User.objects.get_or_create(email=email)
            user.full_name = full_name
            user.is_active = True
            user.set_password(self.password)
            user.save(update_fields=["full_name", "is_active", "password"])
            users[role] = user
        return users

    def seed_workspace_demo(self, demo, users, owner):
        with transaction.atomic():
            workspace = self.create_workspace(owner, demo)
            self.create_memberships(workspace, users, owner)
            CatalogSeedService.seed_default_units(workspace)
            units = self.create_units(workspace)
            categories = self.create_categories(workspace)
            warehouses, locations = self.create_warehouses(workspace, demo["warehouses"])
            products = self.create_products(workspace, units, categories)
            invites = self.create_pending_invites(workspace, owner, demo["invites"])

        stock_seeded = False
        if not self.skip_stock:
            stock_seeded = self.seed_stock_if_needed(
                workspace=workspace,
                actor=owner,
                products=products,
                warehouses=warehouses,
                locations=locations,
                demo=demo,
            )

        return {
            "workspace": workspace,
            "invites": invites,
            "stock_seeded": stock_seeded,
        }

    def create_workspace(self, owner, demo):
        try:
            workspace = Workspace.objects.get(subdomain=demo["subdomain"])
            workspace.name = demo["name"]
            workspace.slug = demo["subdomain"]
            workspace.status = WorkspaceStatus.ACTIVE
            workspace.default_timezone = "Asia/Karachi"
            workspace.low_stock_dashboard_enabled = True
            workspace.created_by = owner
            workspace.save(
                update_fields=[
                    "name",
                    "slug",
                    "status",
                    "default_timezone",
                    "low_stock_dashboard_enabled",
                    "created_by",
                    "updated_at",
                ]
            )
            return workspace
        except Workspace.DoesNotExist:
            workspace = WorkspaceService.create_workspace(
                owner_user=owner,
                name=demo["name"],
                subdomain=demo["subdomain"],
            )
            workspace.default_timezone = "Asia/Karachi"
            workspace.save(update_fields=["default_timezone", "updated_at"])
            return workspace

    def create_memberships(self, workspace, users, owner):
        for role, user in users.items():
            WorkspaceMembership.objects.update_or_create(
                workspace=workspace,
                user=user,
                defaults={
                    "role": role,
                    "status": MembershipStatus.ACTIVE,
                    "invited_by": None if role == WorkspaceRole.OWNER else owner,
                    "joined_at": timezone.now(),
                },
            )

    def create_units(self, workspace):
        units = {}
        for name, abbreviation in EXTRA_UNITS:
            UnitOfMeasure.objects.update_or_create(
                workspace=workspace,
                abbreviation=abbreviation,
                defaults={"name": name, "is_active": True},
            )

        for unit in UnitOfMeasure.objects.filter(workspace=workspace):
            units[unit.abbreviation] = unit
        return units

    def create_categories(self, workspace):
        categories = {}
        for name, description in CATEGORIES:
            category, _ = ProductCategory.objects.update_or_create(
                workspace=workspace,
                name=name,
                defaults={"description": description, "is_active": True},
            )
            categories[name] = category
        return categories

    def create_warehouses(self, workspace, warehouse_data):
        warehouses = {}
        locations = {}
        for item in warehouse_data:
            warehouse, _ = Warehouse.objects.update_or_create(
                workspace=workspace,
                code=item["code"],
                defaults={
                    "name": item["name"],
                    "address_line1": item["address_line1"],
                    "address_line2": item["address_line2"],
                    "city": item["city"],
                    "country": item["country"],
                    "status": item["status"],
                },
            )
            warehouses[item["code"]] = warehouse

            for code, name, location_type in item["locations"]:
                location, _ = WarehouseLocation.objects.update_or_create(
                    workspace=workspace,
                    warehouse=warehouse,
                    code=code,
                    defaults={
                        "name": name,
                        "location_type": location_type,
                        "status": item["status"],
                    },
                )
                locations[(item["code"], code)] = location

        return warehouses, locations

    def create_products(self, workspace, units, categories):
        products = {}
        for item in PRODUCTS:
            product, _ = Product.objects.update_or_create(
                workspace=workspace,
                sku=item["sku"],
                defaults={
                    "name": item["name"],
                    "category": categories[item["category"]],
                    "unit": units[item["unit"]],
                    "description": f"Pakistan demo item for {item['category'].lower()}.",
                    "is_active": True,
                    "low_stock_threshold": Decimal(item["threshold"]),
                    "default_cost": Decimal(item["cost"]),
                },
            )
            products[item["sku"]] = product
        return products

    def create_pending_invites(self, workspace, owner, invites_data):
        invites = []
        for email, role in invites_data:
            invite = WorkspaceInvite.objects.filter(
                workspace=workspace,
                email=email,
                status=InviteStatus.PENDING,
            ).first()
            if invite is None:
                invite = WorkspaceInvite.objects.create(
                    workspace=workspace,
                    email=email,
                    role=role,
                    invited_by=owner,
                )
            invites.append(invite)
        return invites

    def seed_stock_if_needed(self, workspace, actor, products, warehouses, locations, demo):
        if StockMovement.objects.filter(
            workspace=workspace,
            reference_type=DEMO_REFERENCE_TYPE,
        ).exists():
            return False

        with transaction.atomic():
            for sku, warehouse_code, location_code, quantity in demo["opening_stock"]:
                InventoryService.stock_in(
                    workspace=workspace,
                    product=products[sku],
                    warehouse=warehouses[warehouse_code],
                    location=locations[(warehouse_code, location_code)],
                    quantity=Decimal(quantity),
                    actor=actor,
                    reason="Opening stock for Pakistan demo",
                    reference_type=DEMO_REFERENCE_TYPE,
                    notes=f"{workspace.subdomain} Pakistan demo seed",
                )

            for sku, warehouse_code, location_code, quantity, reason in demo["stock_outs"]:
                InventoryService.stock_out(
                    workspace=workspace,
                    product=products[sku],
                    warehouse=warehouses[warehouse_code],
                    location=locations[(warehouse_code, location_code)],
                    quantity=Decimal(quantity),
                    actor=actor,
                    reason=reason,
                    reference_type=DEMO_REFERENCE_TYPE,
                    notes=f"{workspace.subdomain} Pakistan demo seed",
                )

            for (
                sku,
                source_warehouse_code,
                source_location_code,
                destination_warehouse_code,
                destination_location_code,
                quantity,
                reason,
            ) in demo["transfers"]:
                InventoryService.transfer_stock(
                    workspace=workspace,
                    product=products[sku],
                    source_warehouse=warehouses[source_warehouse_code],
                    source_location=locations[
                        (source_warehouse_code, source_location_code)
                    ],
                    destination_warehouse=warehouses[destination_warehouse_code],
                    destination_location=locations[
                        (destination_warehouse_code, destination_location_code)
                    ],
                    quantity=Decimal(quantity),
                    actor=actor,
                    reason=reason,
                    reference_type=DEMO_REFERENCE_TYPE,
                    notes=f"{workspace.subdomain} Pakistan demo seed",
                )

            for (
                sku,
                warehouse_code,
                location_code,
                counted_quantity,
                reason,
            ) in demo["adjustments"]:
                InventoryService.adjust_stock(
                    workspace=workspace,
                    product=products[sku],
                    warehouse=warehouses[warehouse_code],
                    location=locations[(warehouse_code, location_code)],
                    counted_quantity=Decimal(counted_quantity),
                    actor=actor,
                    reason=reason,
                    notes=f"{workspace.subdomain} Pakistan demo seed",
                )

        return True

    def write_summary(self, users, summaries):
        self.stdout.write(self.style.SUCCESS("Pakistan demo data is ready."))
        self.stdout.write("")
        self.stdout.write(f"Password for all demo users: {self.password}")
        self.stdout.write("")
        self.stdout.write("Demo users:")
        for role, user in users.items():
            self.stdout.write(f"- {role}: {user.email}")
        self.stdout.write("")
        self.stdout.write("Workspaces:")
        for summary in summaries:
            workspace = summary["workspace"]
            self.stdout.write(f"- {workspace.name} ({workspace.subdomain})")
            self.stdout.write(f"  Tenant API host: {workspace.subdomain}.localhost:8000")
            self.stdout.write(f"  Pending invites: {len(summary['invites'])}")
            if self.skip_stock:
                self.stdout.write("  Stock movements skipped by --skip-stock.")
            elif summary["stock_seeded"]:
                self.stdout.write("  Stock movements seeded.")
            else:
                self.stdout.write("  Stock movements already existed; skipped duplicate seed.")
