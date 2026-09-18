from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from accounts.models import Organization, UserProfile
from business.models import BusinessSettings

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
      shop_name = options["shop_name"].strip()
      username = options["username"].strip()
      password = options["password"]
      slug = (options["slug"] or "").strip()

      if not shop_name:
          raise CommandError("shop_name is required.")
      if not username:
          raise CommandError("--username is required.")
      if len(password) < 8:
          raise CommandError("Password must be at least 8 characters.")

      if User.objects.filter(username=username).exists():
          raise CommandError(f"Username '{username}' already exists.")

      org = Organization(name=shop_name, slug=slug) if slug else Organization(name=shop_name)
      org.save()

      user = User.objects.create_user(
          username=username,
          password=password,
          email=options["email"] or "",
          is_staff=True,
      )
      UserProfile.objects.create(user=user, organization=org, role=UserProfile.ROLE_OWNER)
      settings = BusinessSettings.load(org)
      settings.business_name = shop_name
      settings.owner_name = ""
      settings.phone = ""
      settings.address = ""
      settings.factory_details = ""
      settings.setup_completed = False
      settings.save()

      self.stdout.write(self.style.SUCCESS("Ledger created successfully."))
      self.stdout.write(f"  Organization: {org.name} (slug: {org.slug}, id: {org.id})")
      self.stdout.write(f"  Username:     {username}")
      self.stdout.write("  Use these credentials on the Smart Ledger login screen.")
