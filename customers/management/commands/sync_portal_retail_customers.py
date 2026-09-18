from django.core.management.base import BaseCommand

from accounts.models import Organization
from customers.portal_retail import sync_portal_retail_customers_from_bills


class Command(BaseCommand):
    help = (
        "Create missing retail customers from walk-in bill names and relink simple bills. "
        "Run after deploy if history shows customer names that are missing from Customers."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--org",
            type=str,
            default="",
            help="Organization slug (default: all organizations)",
        )

    def handle(self, *args, **options):
        slug = (options.get("org") or "").strip()
        orgs = Organization.objects.all()
        if slug:
            orgs = orgs.filter(slug=slug)
            if not orgs.exists():
                self.stderr.write(self.style.ERROR(f"No organization with slug '{slug}'"))
                return

        total = {"bills_relinked": 0, "wholesale_flags_cleared": 0}
        for org in orgs:
            stats = sync_portal_retail_customers_from_bills(org)
            self.stdout.write(
                f"{org.name}: relinked {stats['bills_relinked']}, "
                f"wholesale flags cleared {stats['wholesale_flags_cleared']}"
            )
            for key in total:
                total[key] += stats[key]

        self.stdout.write(
            self.style.SUCCESS(
                f"Done — relinked {total['bills_relinked']}, "
                f"wholesale flags cleared {total['wholesale_flags_cleared']}"
            )
        )
