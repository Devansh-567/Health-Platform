import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { transfersApi, PatientTransfer } from "../../api/transfers.api";
import { usersApi, UserListItem } from "../../api/users.api";
import { hospitalsApi, Hospital } from "../../api/hospitals.api";
import { ambulancesApi, Ambulance } from "../../api/ambulances.api";
import { tripsApi, AmbulanceTrip } from "../../api/trips.api";
import { useAuth } from "../../context/AuthContext";
import { PERMISSIONS } from "../../constants/permissions";
import { PageHeader, StatusBadge } from "../../components/UiPrimitives";
import { Modal } from "../../components/Modal";
import { Alert, PrimaryButton } from "../../components/FormControls";

type TabKey = "incoming" | "outgoing";

function fullName(p: { firstName: string; lastName: string }) {
  return `${p.firstName} ${p.lastName}`;
}

export default function TransfersPage() {
  const { hasRole, hasPermission } = useAuth();
  const isSuperAdmin = hasRole("SUPER_ADMIN");
  const canDispatch = hasPermission(PERMISSIONS.AMBULANCE_TRIP_MANAGE);

  const [activeTab, setActiveTab] = useState<TabKey>("incoming");
  const [incoming, setIncoming] = useState<PatientTransfer[]>([]);
  const [outgoing, setOutgoing] = useState<PatientTransfer[]>([]);
  const [tripsByTransfer, setTripsByTransfer] = useState<Record<string, AmbulanceTrip>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRequest, setShowRequest] = useState(false);
  const [dispatchFor, setDispatchFor] = useState<PatientTransfer | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [inRes, outRes] = await Promise.all([transfersApi.listIncoming(), transfersApi.listOutgoing()]);
      setIncoming(inRes.data ?? []);
      setOutgoing(outRes.data ?? []);

      if (canDispatch) {
        const tripsRes = await tripsApi.list({});
        const byTransfer: Record<string, AmbulanceTrip> = {};
        for (const trip of tripsRes.data ?? []) {
          // Keep the most recently assigned trip per transfer (a cancelled
          // trip can be followed by a fresh dispatch).
          const existing = byTransfer[trip.transferId];
          if (!existing || new Date(trip.assignedAt) > new Date(existing.assignedAt)) {
            byTransfer[trip.transferId] = trip;
          }
        }
        setTripsByTransfer(byTransfer);
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to load transfer requests");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const pendingIncomingCount = incoming.filter((t) => t.status === "PENDING").length;

  const handleAccept = async (t: PatientTransfer) => {
    if (
      !confirm(
        `Accept the transfer of ${fullName(t.patient.user)} from ${t.fromHospital.name}? Your hospital will gain full access to this patient's complete clinical history (reports, diagnoses, prescriptions, vitals and notes), and the patient will move onto your hospital's roster.`
      )
    )
      return;
    try {
      await transfersApi.accept(t.id);
      setActionMessage(`Transfer accepted — ${fullName(t.patient.user)} is now registered at your hospital.`);
      load();
    } catch (err: any) {
      alert(err?.message ?? "Failed to accept transfer");
    }
  };

  const handleReject = async (t: PatientTransfer) => {
    const note = prompt("Optional note for the requesting hospital (leave blank to skip):");
    if (note === null) return;
    try {
      await transfersApi.reject(t.id, note || undefined);
      setActionMessage(`Transfer request for ${fullName(t.patient.user)} rejected.`);
      load();
    } catch (err: any) {
      alert(err?.message ?? "Failed to reject transfer");
    }
  };

  const handleCancel = async (t: PatientTransfer) => {
    if (!confirm(`Cancel the pending transfer request for ${fullName(t.patient.user)}?`)) return;
    try {
      await transfersApi.cancel(t.id);
      setActionMessage("Transfer request cancelled.");
      load();
    } catch (err: any) {
      alert(err?.message ?? "Failed to cancel transfer");
    }
  };

  const rows = activeTab === "incoming" ? incoming : outgoing;

  return (
    <div className="p-8">
      <PageHeader
        title="Interhospital Transfers"
        subtitle="Move a patient's care — and their full clinical history — from one hospital to another"
        action={
          <button
            onClick={() => setShowRequest(true)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            + Request transfer
          </button>
        }
      />

      {error && <Alert>{error}</Alert>}
      {actionMessage && <Alert variant="success">{actionMessage}</Alert>}

      <div className="mb-6 flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {(["incoming", "outgoing"] as TabKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium capitalize transition ${
              activeTab === key
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            {key === "incoming" ? "Incoming requests" : "Outgoing requests"}
            {key === "incoming" && pendingIncomingCount > 0 && (
              <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">
                {pendingIncomingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-sm text-slate-400 dark:text-slate-500">Loading...</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3">To</th>
                <th className="px-4 py-3">{activeTab === "incoming" ? "Requested by" : "Requested"}</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                    {activeTab === "incoming"
                      ? "No transfer requests have been sent to your hospital."
                      : "You haven't requested any transfers yet."}
                  </td>
                </tr>
              ) : (
                rows.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800 dark:text-slate-100">{fullName(t.patient.user)}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t.patient.user.email}
                        {t.patient.medicalRecordNo ? ` · MRN ${t.patient.medicalRecordNo}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{t.fromHospital.name}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{t.toHospital.name}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {activeTab === "incoming" ? fullName(t.initiatedBy) : new Date(t.requestedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={t.status} />
                      {t.reason && <p className="mt-1 max-w-xs text-xs text-slate-400 dark:text-slate-500">{t.reason}</p>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {t.status === "PENDING" && activeTab === "incoming" && (
                        <>
                          <button onClick={() => handleAccept(t)} className="mr-3 text-sm font-medium text-brand-600 hover:underline">
                            Accept
                          </button>
                          <button onClick={() => handleReject(t)} className="text-sm font-medium text-red-600 hover:underline">
                            Reject
                          </button>
                        </>
                      )}
                      {t.status === "PENDING" && activeTab === "outgoing" && (
                        <button onClick={() => handleCancel(t)} className="text-sm font-medium text-red-600 hover:underline">
                          Cancel
                        </button>
                      )}
                      {t.status === "ACCEPTED" && canDispatch && (
                        <AmbulanceAction transfer={t} trip={tripsByTransfer[t.id]} onDispatch={() => setDispatchFor(t)} />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showRequest && (
        <RequestTransferModal
          isSuperAdmin={isSuperAdmin}
          onClose={() => setShowRequest(false)}
          onRequested={() => {
            setShowRequest(false);
            setActiveTab("outgoing");
            load();
          }}
        />
      )}

      {dispatchFor && (
        <DispatchAmbulanceModal
          transfer={dispatchFor}
          onClose={() => setDispatchFor(null)}
          onDispatched={() => {
            setDispatchFor(null);
            setActionMessage(`Ambulance dispatched for ${fullName(dispatchFor.patient.user)}.`);
            load();
          }}
        />
      )}
    </div>
  );
}

const ACTIVE_TRIP_STATUSES = ["ASSIGNED", "EN_ROUTE_TO_PICKUP", "ARRIVED_AT_PICKUP", "EN_ROUTE_TO_HOSPITAL"];

function AmbulanceAction({
  trip,
  onDispatch,
}: {
  transfer: PatientTransfer;
  trip: AmbulanceTrip | undefined;
  onDispatch: () => void;
}) {
  if (trip && ACTIVE_TRIP_STATUSES.includes(trip.status)) {
    return (
      <Link to={`/trips/${trip.id}`} className="text-sm font-medium text-brand-600 hover:underline">
        Track ambulance ({trip.status.replaceAll("_", " ").toLowerCase()})
      </Link>
    );
  }
  if (trip && trip.status === "COMPLETED") {
    return <span className="text-xs text-slate-400 dark:text-slate-500">Delivered by ambulance</span>;
  }
  return (
    <button onClick={onDispatch} className="text-sm font-medium text-brand-600 hover:underline">
      Dispatch ambulance
    </button>
  );
}

function DispatchAmbulanceModal({
  transfer,
  onClose,
  onDispatched,
}: {
  transfer: PatientTransfer;
  onClose: () => void;
  onDispatched: () => void;
}) {
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [drivers, setDrivers] = useState<UserListItem[]>([]);
  const [ambulanceId, setAmbulanceId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [useCustomPickup, setUseCustomPickup] = useState(false);
  const [pickupLat, setPickupLat] = useState("");
  const [pickupLng, setPickupLng] = useState("");
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      ambulancesApi.list({ status: "AVAILABLE", hospitalId: transfer.fromHospital.id }),
      usersApi.list({ roleCode: "DRIVER", hospitalId: transfer.fromHospital.id, pageSize: 50 }),
    ])
      .then(([ambRes, driverRes]) => {
        setAmbulances(ambRes.data ?? []);
        setDrivers(driverRes.data?.items ?? []);
      })
      .catch((err) => setError(err?.message ?? "Failed to load ambulances/drivers"))
      .finally(() => setIsLoadingOptions(false));
  }, [transfer.fromHospital.id]);

  const handleSubmit = async () => {
    if (!ambulanceId || !driverId) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await tripsApi.dispatch({
        transferId: transfer.id,
        ambulanceId,
        driverId,
        pickupAddress: pickupAddress.trim() || undefined,
        ...(useCustomPickup && pickupLat && pickupLng
          ? { pickupLat: Number(pickupLat), pickupLng: Number(pickupLng) }
          : {}),
      });
      onDispatched();
    } catch (err: any) {
      setError(err?.message ?? "Failed to dispatch ambulance");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Dispatch ambulance" onClose={onClose}>
      {error && <Alert>{error}</Alert>}
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        {fullName(transfer.patient.user)} · {transfer.fromHospital.name} → {transfer.toHospital.name}
      </p>

      {isLoadingOptions ? (
        <div className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">Loading fleet...</div>
      ) : ambulances.length === 0 ? (
        <Alert>No available ambulances at {transfer.fromHospital.name} right now.</Alert>
      ) : drivers.length === 0 ? (
        <Alert>No drivers found at {transfer.fromHospital.name}. Invite one from the Staff page first.</Alert>
      ) : (
        <>
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Ambulance</label>
            <select
              value={ambulanceId}
              onChange={(e) => setAmbulanceId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select an ambulance...</option>
              {ambulances.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.vehicleNumber}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Driver</label>
            <select
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select a driver...</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {fullName(d)}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Pickup note (optional)</label>
            <input
              type="text"
              value={pickupAddress}
              onChange={(e) => setPickupAddress(e.target.value)}
              placeholder={`Defaults to ${transfer.fromHospital.name}`}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={useCustomPickup} onChange={(e) => setUseCustomPickup(e.target.checked)} />
              Pickup somewhere other than {transfer.fromHospital.name} (accident site, patient's home, etc.)
            </label>
            {useCustomPickup && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="any"
                  value={pickupLat}
                  onChange={(e) => setPickupLat(e.target.value)}
                  placeholder="Latitude"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500"
                />
                <input
                  type="number"
                  step="any"
                  value={pickupLng}
                  onChange={(e) => setPickupLng(e.target.value)}
                  placeholder="Longitude"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            )}
          </div>

          <PrimaryButton type="button" onClick={handleSubmit} disabled={!ambulanceId || !driverId} isLoading={isSubmitting}>
            Dispatch
          </PrimaryButton>
        </>
      )}
    </Modal>
  );
}

function RequestTransferModal({
  isSuperAdmin,
  onClose,
  onRequested,
}: {
  isSuperAdmin: boolean;
  onClose: () => void;
  onRequested: () => void;
}) {
  const [step, setStep] = useState<"patient" | "destination">("patient");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState<UserListItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<UserListItem | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [toHospitalId, setToHospitalId] = useState("");
  const [reason, setReason] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    setIsSearching(true);
    usersApi
      .list({ roleCode: "PATIENT", search: search || undefined, pageSize: 10 })
      .then((res) => setPatients(res.data?.items ?? []))
      .catch((err) => setServerError(err?.message ?? "Search failed"))
      .finally(() => setIsSearching(false));
  }, [search]);

  useEffect(() => {
    if (step === "destination") {
      hospitalsApi.list({ isActive: "true", pageSize: 100 }).then((res) => setHospitals(res.data?.items ?? []));
    }
  }, [step]);

  const handlePickPatient = (p: UserListItem) => {
    if (!p.hospital) {
      setServerError("This patient isn't currently linked to a hospital, so there's nothing to transfer from.");
      return;
    }
    setSelectedPatient(p);
    setToHospitalId("");
    setServerError(null);
    setStep("destination");
  };

  const handleSubmit = async () => {
    if (!selectedPatient || !toHospitalId) return;
    setIsSubmitting(true);
    setServerError(null);
    try {
      await transfersApi.initiate({ patientUserId: selectedPatient.id, toHospitalId, reason: reason.trim() || undefined });
      onRequested();
    } catch (err: any) {
      setServerError(err?.message ?? "Failed to send transfer request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const destinationOptions = hospitals.filter((h) => h.id !== selectedPatient?.hospital?.id);

  return (
    <Modal title="Request interhospital transfer" onClose={onClose}>
      {serverError && <Alert>{serverError}</Alert>}

      {step === "patient" ? (
        <>
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
            {isSuperAdmin
              ? "Search for the patient to transfer, across any hospital."
              : "Search for the patient to transfer — only patients currently at your own hospital can be selected."}
          </p>
          <input
            type="text"
            autoFocus
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search patients by name or email..."
            className="mb-4 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500"
          />
          <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
            {isSearching ? (
              <div className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">Searching...</div>
            ) : patients.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                {search ? `No patients match "${search}".` : "No patients found."}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                {patients.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{fullName(p)}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {p.email} · {p.hospital?.name ?? "No hospital linked"}
                      </p>
                    </div>
                    <button
                      onClick={() => handlePickPatient(p)}
                      className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                    >
                      Select
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        selectedPatient && (
          <>
            <div className="mb-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{fullName(selectedPatient)}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Currently at {selectedPatient.hospital?.name}</p>
              <button onClick={() => setStep("patient")} className="mt-1 text-xs font-medium text-brand-600 hover:underline">
                Change patient
              </button>
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Destination hospital</label>
              <select
                value={toHospitalId}
                onChange={(e) => setToHospitalId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Select a hospital...</option>
                {destinationOptions.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Reason (optional)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Why is this patient being transferred?"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
              The receiving hospital's admin will need to confirm this request. Once accepted, they'll gain full access
              to this patient's reports, diagnoses, prescriptions, vitals and notes, and the patient will move onto
              their roster.
            </p>

            <PrimaryButton type="button" onClick={handleSubmit} disabled={!toHospitalId} isLoading={isSubmitting}>
              Send transfer request
            </PrimaryButton>
          </>
        )
      )}
    </Modal>
  );
}
