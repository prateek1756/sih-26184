"""initial postgis schema

Revision ID: 0001_initial_postgis_schema
Revises: 
Create Date: 2026-09-02 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import geoalchemy2

# revision identifiers, used by Alembic.
revision = '0001_initial_postgis_schema'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Enable PostGIS Extension
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis;")

    # 2. Users table
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(255), unique=True, nullable=False),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(100), nullable=False),
        sa.Column('badge_number', sa.String(50), nullable=True),
        sa.Column('agency', sa.String(100), nullable=True),
        sa.Column('role', sa.String(50), nullable=False, server_default='VIEWER'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('idx_users_email', 'users', ['email'])

    # 3. Complaints table
    op.create_table(
        'complaints',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('complaint_number', sa.String(50), unique=True, nullable=False),
        sa.Column('filed_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('category', sa.String(100), nullable=False),
        sa.Column('subcategory', sa.String(100), nullable=True),
        sa.Column('reported_amount', sa.Numeric(18, 2), nullable=False, server_default='0.0'),
        sa.Column('victim_state', sa.String(50), nullable=True),
        sa.Column('victim_city', sa.String(100), nullable=True),
        sa.Column('status', sa.String(30), server_default='open'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('idx_complaints_number', 'complaints', ['complaint_number'])
    op.create_index('idx_complaints_category', 'complaints', ['category'])
    op.create_index('idx_complaints_city', 'complaints', ['victim_city'])

    # 4. Bank Accounts table
    op.create_table(
        'accounts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('account_hash', sa.String(64), unique=True, nullable=False),
        sa.Column('bank_name', sa.String(100), nullable=False),
        sa.Column('account_type', sa.String(30), nullable=True),
        sa.Column('risk_tier', sa.String(20), server_default='LOW'),
        sa.Column('is_mule_suspected', sa.Boolean(), server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('idx_accounts_hash', 'accounts', ['account_hash'])
    op.create_index('idx_accounts_mule', 'accounts', ['is_mule_suspected'])

    # 5. ATM Locations table with PostGIS Geometry
    op.create_table(
        'atm_locations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('atm_code', sa.String(50), unique=True, nullable=False),
        sa.Column('bank_name', sa.String(100), nullable=False),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('city', sa.String(100), nullable=False),
        sa.Column('district', sa.String(100), nullable=True),
        sa.Column('state', sa.String(50), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=False),
        sa.Column('longitude', sa.Float(), nullable=False),
        sa.Column('location', geoalchemy2.Geometry(geometry_type='POINT', srid=4326, spatial_index=False), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('idx_atm_locations_code', 'atm_locations', ['atm_code'])
    op.create_index('idx_atm_locations_city', 'atm_locations', ['city'])
    op.create_index('idx_atm_locations_location', 'atm_locations', ['location'], postgresql_using='gist')

    # 6. Suspicious Transactions table
    op.create_table(
        'suspicious_transactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('complaint_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('complaints.id', ondelete='CASCADE'), nullable=False),
        sa.Column('account_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('accounts.id'), nullable=True),
        sa.Column('amount', sa.Numeric(18, 2), nullable=False),
        sa.Column('transaction_type', sa.String(50), nullable=False),
        sa.Column('occurred_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=False),
        sa.Column('longitude', sa.Float(), nullable=False),
        sa.Column('location', geoalchemy2.Geometry(geometry_type='POINT', srid=4326, spatial_index=False), nullable=True),
        sa.Column('velocity_score', sa.Numeric(5, 2), server_default='0.0'),
        sa.Column('is_flagged', sa.Boolean(), server_default='false'),
        sa.Column('is_cash_out', sa.Boolean(), server_default='false'),
        sa.Column('atm_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('atm_locations.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('idx_suspicious_tx_location', 'suspicious_transactions', ['location'], postgresql_using='gist')
    op.create_index('idx_suspicious_tx_occurred_at', 'suspicious_transactions', ['occurred_at'])
    op.create_index('idx_suspicious_tx_flagged', 'suspicious_transactions', ['is_flagged'])
    op.create_index('idx_suspicious_tx_cash_out', 'suspicious_transactions', ['is_cash_out'])

    # 7. Model Runs table
    op.create_table(
        'model_runs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('model_name', sa.String(100), nullable=False),
        sa.Column('model_version', sa.String(20), unique=True, nullable=False),
        sa.Column('trained_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('precision_score', sa.Numeric(6, 4), nullable=True),
        sa.Column('recall_score', sa.Numeric(6, 4), nullable=True),
        sa.Column('f1_score', sa.Numeric(6, 4), nullable=True),
        sa.Column('pr_auc', sa.Numeric(6, 4), nullable=True),
        sa.Column('roc_auc', sa.Numeric(6, 4), nullable=True),
        sa.Column('precision_at_k', sa.Numeric(6, 4), nullable=True),
        sa.Column('parameters', sa.JSON(), nullable=True),
        sa.Column('feature_importances', sa.JSON(), nullable=True),
        sa.Column('artifact_path', sa.Text(), nullable=True),
        sa.Column('is_production', sa.Boolean(), server_default='false'),
        sa.Column('notes', sa.Text(), nullable=True),
    )
    op.create_index('idx_model_runs_version', 'model_runs', ['model_version'])
    op.create_index('idx_model_runs_production', 'model_runs', ['is_production'])

    # 8. Risk Predictions table
    op.create_table(
        'risk_predictions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('predicted_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('model_version', sa.String(20), nullable=False),
        sa.Column('location_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('atm_locations.id', ondelete='SET NULL'), nullable=True),
        sa.Column('latitude', sa.Float(), nullable=False),
        sa.Column('longitude', sa.Float(), nullable=False),
        sa.Column('risk_score', sa.Numeric(6, 4), nullable=False),
        sa.Column('severity', sa.String(20), nullable=False),
        sa.Column('confidence', sa.Numeric(6, 4), nullable=False),
        sa.Column('predicted_window_start', sa.DateTime(timezone=True), nullable=False),
        sa.Column('predicted_window_end', sa.DateTime(timezone=True), nullable=False),
        sa.Column('risk_zone', geoalchemy2.Geometry(geometry_type='POLYGON', srid=4326, spatial_index=False), nullable=True),
        sa.Column('reasons', sa.JSON(), nullable=True),
        sa.Column('model_run_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('model_runs.id'), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
    )
    op.create_index('idx_risk_predictions_zone', 'risk_predictions', ['risk_zone'], postgresql_using='gist')
    op.create_index('idx_risk_predictions_active_score', 'risk_predictions', ['is_active', 'risk_score'])
    op.create_index('idx_risk_predictions_severity', 'risk_predictions', ['severity'])

    # 9. Alerts table
    op.create_table(
        'alerts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('prediction_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('risk_predictions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('severity', sa.String(20), nullable=False),
        sa.Column('status', sa.String(20), server_default='open'),
        sa.Column('assigned_to', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolution_notes', sa.Text(), nullable=True),
    )
    op.create_index('idx_alerts_status_severity', 'alerts', ['status', 'severity'])

    # 10. Investigations & Notes
    op.create_table(
        'investigations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('case_number', sa.String(50), unique=True, nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('alert_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('alerts.id', ondelete='SET NULL'), nullable=True),
        sa.Column('lead_investigator_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('status', sa.String(30), server_default='active'),
        sa.Column('priority', sa.String(20), server_default='MEDIUM'),
        sa.Column('findings', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('idx_investigations_case_number', 'investigations', ['case_number'])
    op.create_index('idx_investigations_status', 'investigations', ['status'])

    op.create_table(
        'investigation_notes',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('investigation_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('investigations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('author_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('note', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('idx_investigation_notes_inv', 'investigation_notes', ['investigation_id'])

    # 11. Audit Events table
    op.create_table(
        'audit_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('event_type', sa.String(50), nullable=False),
        sa.Column('actor_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('actor_role', sa.String(50), nullable=True),
        sa.Column('resource_type', sa.String(50), nullable=False),
        sa.Column('resource_id', sa.String(100), nullable=True),
        sa.Column('action_details', sa.JSON(), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('occurred_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('blockchain_hash', sa.String(64), nullable=True),
    )
    op.create_index('idx_audit_events_occurred', 'audit_events', ['occurred_at'])
    op.create_index('idx_audit_events_type', 'audit_events', ['event_type'])


def downgrade() -> None:
    op.drop_table('audit_events')
    op.drop_table('investigation_notes')
    op.drop_table('investigations')
    op.drop_table('alerts')
    op.drop_table('risk_predictions')
    op.drop_table('model_runs')
    op.drop_table('suspicious_transactions')
    op.drop_table('atm_locations')
    op.drop_table('accounts')
    op.drop_table('complaints')
    op.drop_table('users')
    op.execute("DROP EXTENSION IF EXISTS postgis;")
