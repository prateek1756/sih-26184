"""make suspicious_transactions.complaint_id nullable

Revision ID: 0002_nullable_complaint_id
Revises: 0001_initial_postgis_schema
Create Date: 2026-09-03

Rationale:
  Live-ingested transactions (from POST /api/v1/risk/ingest) arrive as raw
  banking events that are NOT yet linked to a cybercrime complaint.
  Forcing complaint_id to be NOT NULL created a false sentinel relationship
  that violated data integrity.  Making the column nullable is the minimum
  safe additive change: existing complaint-linked transactions are unaffected;
  live-ingested transactions now correctly record NULL.

No destructive changes.  Existing rows are unchanged.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = '0002_nullable_complaint_id'
down_revision = '0001_initial_postgis_schema'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the NOT NULL constraint on complaint_id.
    # Existing rows already have a value so this is safe.
    op.alter_column(
        'suspicious_transactions',
        'complaint_id',
        existing_type=sa.dialects.postgresql.UUID(as_uuid=True),
        nullable=True,
    )


def downgrade() -> None:
    # Re-apply NOT NULL (only safe if all rows have a value).
    op.alter_column(
        'suspicious_transactions',
        'complaint_id',
        existing_type=sa.dialects.postgresql.UUID(as_uuid=True),
        nullable=False,
    )
