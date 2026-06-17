"""invoices: Invoice / InvoiceLine / InvoiceSequence + business_profile invoicing fields

French invoice generation (Phase 1). Adds:
- invoice_sequences: gapless per-user, per-series counter (assigned at issuance).
- invoices: immutable issued document with frozen issuer/client snapshot.
- invoice_lines: one billable line per class.
- business_profiles: SIRET/contact/bank + legal-mention toggles + numbering config.

Encrypted columns are stored as TEXT (EncryptedString.impl = Text), holding
Fernet ciphertext.

Revision ID: 0022
Revises: 0021
Create Date: 2026-06-14
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = '0022'
down_revision = '0021'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- business_profiles: invoicing identity, bank, legal toggles, numbering ---
    op.add_column('business_profiles', sa.Column('siret', sa.Text(), nullable=True))
    op.add_column('business_profiles', sa.Column('phone', sa.Text(), nullable=True))
    op.add_column('business_profiles', sa.Column('email', sa.Text(), nullable=True))
    op.add_column('business_profiles', sa.Column('iban', sa.Text(), nullable=True))
    op.add_column('business_profiles', sa.Column('bic', sa.Text(), nullable=True))
    op.add_column('business_profiles', sa.Column(
        'rcs_dispense', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('business_profiles', sa.Column(
        'vat_exempt', sa.Boolean(), nullable=False, server_default=sa.text('true')))
    op.add_column('business_profiles', sa.Column('payment_conditions', sa.Text(), nullable=True))
    op.add_column('business_profiles', sa.Column(
        'invoice_number_format', sa.String(40), nullable=False, server_default='YYYY-MM-NN'))
    op.add_column('business_profiles', sa.Column(
        'invoice_sequence_scope', sa.String(10), nullable=False, server_default='monthly'))

    # --- invoice_sequences: gapless counter ---
    op.create_table(
        'invoice_sequences',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('series_key', sa.String(20), nullable=False),
        sa.Column('last_number', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )
    op.create_unique_constraint(
        'uq_invoice_sequence_user_series', 'invoice_sequences', ['user_id', 'series_key'])

    # --- invoices: immutable issued document ---
    op.create_table(
        'invoices',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('client_id', sa.Integer(), sa.ForeignKey('clients.id'), nullable=False),
        sa.Column('number', sa.String(40), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='draft'),
        sa.Column('issue_date', sa.Date(), nullable=True),
        sa.Column('period_start', sa.Date(), nullable=True),
        sa.Column('period_end', sa.Date(), nullable=True),
        sa.Column('execution_dates', sa.Text(), nullable=True),
        sa.Column('payment_dates', sa.Text(), nullable=True),
        sa.Column('total_ht', sa.Float(), nullable=False, server_default='0'),
        sa.Column('currency', sa.String(3), nullable=False, server_default='EUR'),
        sa.Column('client_name', sa.String(255), nullable=True),
        sa.Column('client_address', sa.Text(), nullable=True),
        sa.Column('client_tax_id', sa.Text(), nullable=True),
        sa.Column('issuer_name', sa.String(255), nullable=True),
        sa.Column('issuer_address', sa.Text(), nullable=True),
        sa.Column('issuer_siret', sa.Text(), nullable=True),
        sa.Column('pdf_storage_path', sa.String(500), nullable=True),
        sa.Column('pdf_signed_url_expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )

    # --- invoice_lines: one billable line per class ---
    op.create_table(
        'invoice_lines',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('invoice_id', sa.Integer(),
                  sa.ForeignKey('invoices.id', ondelete='CASCADE'), nullable=False),
        sa.Column('designation', sa.String(255), nullable=False),
        sa.Column('quantity', sa.Float(), nullable=False),
        sa.Column('unit_price_ht', sa.Float(), nullable=False),
        sa.Column('total_ht', sa.Float(), nullable=False),
        sa.Column('source_class_id', sa.Integer(), sa.ForeignKey('classes.id'), nullable=True),
    )

    # Match the security posture of the other tables (backend uses service_role,
    # which bypasses RLS; this blocks direct PostgREST access for other roles).
    for tbl in ('invoice_sequences', 'invoices', 'invoice_lines'):
        op.execute(text(f"ALTER TABLE {tbl} ENABLE ROW LEVEL SECURITY"))
        op.execute(text(f"ALTER TABLE {tbl} FORCE ROW LEVEL SECURITY"))


def downgrade() -> None:
    op.drop_table('invoice_lines')
    op.drop_table('invoices')
    op.drop_constraint('uq_invoice_sequence_user_series', 'invoice_sequences', type_='unique')
    op.drop_table('invoice_sequences')
    for col in (
        'invoice_sequence_scope', 'invoice_number_format', 'payment_conditions',
        'vat_exempt', 'rcs_dispense', 'bic', 'iban', 'email', 'phone', 'siret',
    ):
        op.drop_column('business_profiles', col)
