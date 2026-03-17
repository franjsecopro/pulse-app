from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.repositories.client_repository import ClientRepository
from app.repositories.contract_repository import ContractRepository
from app.repositories.payer_repository import PayerRepository
from app.schemas.client import ClientCreateRequest, ClientUpdateRequest, ClientResponse, ClientListResponse
from app.schemas.contract import ContractCreateRequest, ContractUpdateRequest, ContractResponse
from app.schemas.payment_identifier import PayerCreateRequest, PayerUpdateRequest, PayerResponse

router = APIRouter(prefix="/clients", tags=["clients"])


@router.get("", response_model=list[ClientListResponse])
async def list_clients(
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    deleted_filter: str = Query("exclude"),  # 'exclude', 'include', 'only'
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = ClientRepository(db)
    return await repo.get_all(current_user.id, search=search, is_active=is_active, deleted_filter=deleted_filter)


@router.post("", response_model=ClientResponse, status_code=201)
async def create_client(
    data: ClientCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await ClientRepository(db).create(current_user.id, data)


@router.get("/{client_id}", response_model=ClientResponse)
async def get_client(
    client_id: int,
    allow_deleted: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = await ClientRepository(db).get_by_id(client_id, current_user.id, include_deleted=allow_deleted)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


@router.put("/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: int,
    data: ClientUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = ClientRepository(db)
    client = await repo.get_by_id(client_id, current_user.id, include_deleted=True)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return await repo.update(client, data)


@router.delete("/{client_id}", status_code=204)
async def delete_client(
    client_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = ClientRepository(db)
    client = await repo.get_by_id(client_id, current_user.id, include_deleted=True)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    await repo.soft_delete(client)


# --- Contracts sub-resource ---

@router.get("/{client_id}/contracts", response_model=list[ContractResponse])
async def list_contracts(
    client_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = await ClientRepository(db).get_by_id(client_id, current_user.id, include_deleted=True)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return await ContractRepository(db).get_by_client(client_id)


@router.post("/{client_id}/contracts", response_model=ContractResponse, status_code=201)
async def create_contract(
    client_id: int,
    data: ContractCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = await ClientRepository(db).get_by_id(client_id, current_user.id, include_deleted=True)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return await ContractRepository(db).create(client_id, data)


@router.put("/{client_id}/contracts/{contract_id}", response_model=ContractResponse)
async def update_contract(
    client_id: int,
    contract_id: int,
    data: ContractUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = await ClientRepository(db).get_by_id(client_id, current_user.id, include_deleted=True)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    contract_repo = ContractRepository(db)
    contract = await contract_repo.get_by_id(contract_id, client_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    return await contract_repo.update(contract, data)


@router.delete("/{client_id}/contracts/{contract_id}", status_code=204)
async def delete_contract(
    client_id: int,
    contract_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = await ClientRepository(db).get_by_id(client_id, current_user.id, include_deleted=True)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    contract_repo = ContractRepository(db)
    contract = await contract_repo.get_by_id(contract_id, client_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    await contract_repo.soft_delete(contract)


# --- Payers sub-resource ---

@router.get("/{client_id}/payers", response_model=list[PayerResponse])
async def list_payers(
    client_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = await ClientRepository(db).get_by_id(client_id, current_user.id, include_deleted=True)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return await PayerRepository(db).get_by_client(client_id)


@router.post("/{client_id}/payers", response_model=PayerResponse, status_code=201)
async def create_payer(
    client_id: int,
    data: PayerCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = await ClientRepository(db).get_by_id(client_id, current_user.id, include_deleted=True)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return await PayerRepository(db).create(client_id, data)


@router.put("/{client_id}/payers/{payer_id}", response_model=PayerResponse)
async def update_payer(
    client_id: int,
    payer_id: int,
    data: PayerUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = await ClientRepository(db).get_by_id(client_id, current_user.id, include_deleted=True)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    payer_repo = PayerRepository(db)
    payer = await payer_repo.get_by_id(payer_id, client_id)
    if not payer:
        raise HTTPException(status_code=404, detail="Payer not found")
    return await payer_repo.update(payer, data)


@router.delete("/{client_id}/payers/{payer_id}", status_code=204)
async def delete_payer(
    client_id: int,
    payer_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = await ClientRepository(db).get_by_id(client_id, current_user.id, include_deleted=True)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    payer_repo = PayerRepository(db)
    payer = await payer_repo.get_by_id(payer_id, client_id)
    if not payer:
        raise HTTPException(status_code=404, detail="Payer not found")
    await payer_repo.delete(payer)
