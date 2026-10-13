"""001_trusted_device_anti_proxy

Revision ID: 001_trusted_device
Revises: 
Create Date: 2026-10-13 23:55:00.000000

Migration Details:
- Adds trusted-device ownership and lifecycle columns to `devices`.
- Enforces exactly one active trusted phone per student using a partial unique index.
- Implements an explicit backfill strategy: marks legacy devices without verified ownership
  as 'LEGACY_UNCLAIMED', preserving historical attendance records without automatically
  trusting ambiguous hardware.
- Creates `device_reset_logs` for immutable faculty/admin authorized device replacement history.
- Adds classroom presence challenge fields (`presence_code`, `presence_code_expires_at`,
  `presence_challenge_required`) to `attendance_sessions` to defend against remote QR sharing.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '001_trusted_device'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    device_cols = [c["name"] for c in inspector.get_columns("devices")] if inspector.has_table("devices") else []

    # 1. Update `devices` table with ownership and lifecycle fields
    with op.batch_alter_table("devices", schema=None) as batch_op:
        if "student_id" not in device_cols:
            batch_op.add_column(sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id", name="fk_devices_student_id"), nullable=True))
        if "device_secret_hash" not in device_cols:
            batch_op.add_column(sa.Column("device_secret_hash", sa.String(), nullable=True))
        if "status" not in device_cols:
            batch_op.add_column(sa.Column("status", sa.String(), nullable=False, server_default="ACTIVE"))
        if "registered_at" not in device_cols:
            batch_op.add_column(sa.Column("registered_at", sa.DateTime(), nullable=False, server_default=sa.func.now()))
        if "last_used_at" not in device_cols:
            batch_op.add_column(sa.Column("last_used_at", sa.DateTime(), nullable=True))
        if "revoked_at" not in device_cols:
            batch_op.add_column(sa.Column("revoked_at", sa.DateTime(), nullable=True))
        if "revoked_by_user_id" not in device_cols:
            batch_op.add_column(sa.Column("revoked_by_user_id", sa.Integer(), sa.ForeignKey("users.id", name="fk_devices_revoked_by_user_id"), nullable=True))
        if "revocation_reason" not in device_cols:
            batch_op.add_column(sa.Column("revocation_reason", sa.String(), nullable=True))

    # 2. Backfill Strategy for legacy device records
    # Legacy devices created before authenticated enrollment lack cryptographic secrets and student binding.
    # We mark them as 'LEGACY_UNCLAIMED' so historical attendance foreign keys remain valid,
    # but they can NEVER be used to mark attendance under the trusted device policy.
    conn.execute(
        sa.text(
            "UPDATE devices SET status = 'LEGACY_UNCLAIMED', "
            "revocation_reason = 'LEGACY_UNTRUSTED_MIGRATION_BACKFILL' "
            "WHERE student_id IS NULL"
        )
    )

    # 3. Create partial unique index enforcing 1 active trusted device per student
    # Valid in both SQLite (>= 3.8.0) and PostgreSQL
    existing_indexes = [idx["name"] for idx in inspector.get_indexes("devices")]
    if "uq_one_active_device_per_student" not in existing_indexes:
        with op.batch_alter_table("devices", schema=None) as batch_op:
            batch_op.create_index(
                "uq_one_active_device_per_student",
                ["student_id"],
                unique=True,
                sqlite_where=sa.text("status = 'ACTIVE'"),
                postgresql_where=sa.text("status = 'ACTIVE'"),
            )

    # 4. Create `device_reset_logs` table for immutable faculty-authorized reset tracking
    if not inspector.has_table("device_reset_logs"):
        op.create_table(
            "device_reset_logs",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id"), nullable=False, index=True),
            sa.Column("faculty_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
            sa.Column("old_device_id", sa.Integer(), sa.ForeignKey("devices.id"), nullable=True),
            sa.Column("reason", sa.String(), nullable=False),
            sa.Column("timestamp", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("ip_address", sa.String(), nullable=True),
        )

    # 5. Update `attendance_sessions` with classroom presence challenge fields
    if inspector.has_table("attendance_sessions"):
        session_cols = [c["name"] for c in inspector.get_columns("attendance_sessions")]
        with op.batch_alter_table("attendance_sessions", schema=None) as batch_op:
            if "presence_code" not in session_cols:
                batch_op.add_column(sa.Column("presence_code", sa.String(length=16), nullable=True))
            if "presence_code_expires_at" not in session_cols:
                batch_op.add_column(sa.Column("presence_code_expires_at", sa.DateTime(), nullable=True))
            if "presence_challenge_required" not in session_cols:
                batch_op.add_column(sa.Column("presence_challenge_required", sa.Boolean(), nullable=False, server_default="1"))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # Note: Downgrade drops security lifecycle constraints, presence challenges, and reset logs.
    # Historical attendance records and student accounts remain intact.
    if inspector.has_table("attendance_sessions"):
        with op.batch_alter_table("attendance_sessions", schema=None) as batch_op:
            batch_op.drop_column("presence_challenge_required")
            batch_op.drop_column("presence_code_expires_at")
            batch_op.drop_column("presence_code")

    if inspector.has_table("device_reset_logs"):
        op.drop_table("device_reset_logs")

    if inspector.has_table("devices"):
        existing_indexes = [idx["name"] for idx in inspector.get_indexes("devices")]
        with op.batch_alter_table("devices", schema=None) as batch_op:
            if "uq_one_active_device_per_student" in existing_indexes:
                batch_op.drop_index("uq_one_active_device_per_student")
            batch_op.drop_column("revocation_reason")
            batch_op.drop_column("revoked_by_user_id")
            batch_op.drop_column("revoked_at")
            batch_op.drop_column("last_used_at")
            batch_op.drop_column("registered_at")
            batch_op.drop_column("status")
            batch_op.drop_column("device_secret_hash")
            batch_op.drop_column("student_id")
