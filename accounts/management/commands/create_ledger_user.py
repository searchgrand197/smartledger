from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from accounts.services import LedgerProvisioningError, create_ledger_shop

User = get_user_model()


class Command(BaseCommand):
    help = (
        "Create a new ledger (organization) with an owner login. "
        "Each ledger's data is isolated — users only see their own organization."
    )

    def add_arguments(self, parser):
        parser.add_argument("shop_name", help='Display name, e.g. "Acme Hardware"')
        parser.add_argument("--username", required=True, help="Login username (unique across the server)")
        parser.add_argument("--password", required=True, help="Login password (min 8 characters)")
        parser.add_argument("--slug", default="", help="Optional URL slug; auto-generated from shop name if omitted")
        parser.add_argument("--email", default="", help="Optional email for the user")

    def handle(self, *args, **options):
        try:
            org, user = create_ledger_shop(
                shop_name=options["shop_name"],
                username=options["username"],
                password=options["password"],
                slug=options.get("slug") or "",
                email=options.get("email") or "",
            )
        except LedgerProvisioningError as exc:
            raise CommandError(str(exc)) from exc

        self.stdout.write(self.style.SUCCESS("Ledger created successfully."))
        self.stdout.write(f"  Organization: {org.name} (slug: {org.slug}, id: {org.id})")
        self.stdout.write(f"  Username:     {user.username}")
        self.stdout.write("  Use these credentials on the Smart Ledger login screen.")
