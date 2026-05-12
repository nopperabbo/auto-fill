#!/usr/bin/env python3
"""
gen-profiles.py — one-shot generator for profiles.example.json.

Fills profiles.json with 10 US entries using Faker for realistic names /
addresses and Stripe's public test card numbers (documented at
https://stripe.com/docs/testing). Run ONCE; edit profiles.json manually
after that.

Usage:
    python gen-profiles.py [--out ../profiles.json] [--count 10]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    from faker import Faker
except ImportError:
    sys.exit("Missing dependency. Run: pip install -r requirements.txt")


STRIPE_TEST_CARDS = [
    {"number": "4242 4242 4242 4242", "brand": "Visa", "note": "Succeeds"},
    {"number": "4000 0566 5566 5556", "brand": "Visa (debit)", "note": "Succeeds"},
    {"number": "5555 5555 5555 4444", "brand": "Mastercard", "note": "Succeeds"},
    {"number": "2223 0031 2200 3222", "brand": "Mastercard (2-series)", "note": "Succeeds"},
    {"number": "5200 8282 8282 8210", "brand": "Mastercard (debit)", "note": "Succeeds"},
    {"number": "3782 822463 10005",   "brand": "American Express", "note": "Succeeds"},
    {"number": "3714 496353 98431",   "brand": "American Express", "note": "Succeeds"},
    {"number": "6011 1111 1111 1117", "brand": "Discover", "note": "Succeeds"},
    {"number": "3056 930902 5904",    "brand": "Diners Club", "note": "Succeeds"},
    {"number": "3566 0020 2036 0505", "brand": "JCB", "note": "Succeeds"},
]

US_STATE_CODE_TO_NAME = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
    "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
    "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho",
    "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas",
    "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi",
    "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada",
    "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York",
    "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma",
    "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah",
    "VT": "Vermont", "VA": "Virginia", "WA": "Washington", "WV": "West Virginia",
    "WI": "Wisconsin", "WY": "Wyoming",
}


def build_profile(key: str, fake: Faker, card: dict) -> tuple[str, dict]:
    first = fake.first_name()
    last = fake.last_name()
    holder = f"{first} {last}"

    state_code = fake.state_abbr(include_territories=False, include_freely_associated_states=False)
    state_name = US_STATE_CODE_TO_NAME.get(state_code, state_code)

    label = f"{card['brand']} — {holder}"

    profile = {
        "label": label,
        "card": {
            "number": card["number"],
            "expMonth": f"{fake.random_int(min=1, max=12):02d}",
            "expYear": f"{fake.random_int(min=27, max=34):02d}",
            "cvc": f"{fake.random_int(min=100, max=999)}",
            "holder": holder,
        },
        "billing": {
            "email": f"{first.lower()}.{last.lower()}@example.com",
            "phone": f"+1 555 {fake.random_int(min=100, max=199):04d}",
            "country": "US",
            "countryName": "United States",
            "line1": fake.street_address(),
            "line2": "",
            "city": fake.city(),
            "state": state_name,
            "stateCode": state_code,
            "postalCode": fake.postcode_in_state(state_abbr=state_code),
        },
    }
    return key, profile


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="gen-profiles",
        description="One-shot generator for profiles.example.json (US entries + Stripe test cards).",
    )
    parser.add_argument("--out", default=str(Path(__file__).resolve().parent.parent / "profiles.example.json"))
    parser.add_argument("--count", type=int, default=10,
                        help="Number of profiles to generate (1-100). Cards cycle through the 10 Stripe test cards.")
    parser.add_argument("--seed", type=int, default=None, help="Optional Faker seed for reproducible output")
    parser.add_argument("--force", action="store_true", help="Overwrite output file if it exists")
    args = parser.parse_args()

    if args.count < 1 or args.count > 100:
        sys.exit("--count must be between 1 and 100")

    out = Path(args.out)
    if out.exists() and not args.force:
        print(f"Refusing to overwrite {out} (pass --force to overwrite)", file=sys.stderr)
        sys.exit(1)

    fake = Faker("en_US")
    if args.seed is not None:
        Faker.seed(args.seed)

    profiles: dict[str, dict] = {}
    pad = max(2, len(str(args.count)))
    for i in range(1, args.count + 1):
        card = STRIPE_TEST_CARDS[(i - 1) % len(STRIPE_TEST_CARDS)]
        key = f"us_{i:0{pad}d}"
        key, profile = build_profile(key, fake, card)
        profiles[key] = profile

    output = {
        "defaultProfile": next(iter(profiles)),
        "profiles": profiles,
    }

    out.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(profiles)} US profile(s) to {out}")
    if len(profiles) <= 3:
        print("Preview:")
        print(json.dumps(next(iter(profiles.values())), indent=2))
    else:
        keys = list(profiles.keys())
        print(f"Keys: {keys[0]}..{keys[-1]} (default: {output['defaultProfile']})")


if __name__ == "__main__":
    main()
