import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import { PERMISSIONS } from "../src/config/permissions.catalog";

const prisma = new PrismaClient();

const ROLES = [
  { code: "SUPER_ADMIN", name: "Super Admin", description: "Highest system authority", isSystem: true },
  { code: "ADMIN", name: "Admin", description: "Manages hospital operations", isSystem: true },
  { code: "DOCTOR", name: "Doctor", description: "Manages assigned patients and clinical records", isSystem: true },
  { code: "NURSE", name: "Nurse", description: "Records vitals and supports patient care", isSystem: true },
  { code: "PATIENT", name: "Patient", description: "Manages own profile and care records", isSystem: true },
  { code: "DRIVER", name: "Driver", description: "Drives ambulances and reports live GPS location", isSystem: true },
] as const;

// Every permission code is granted to SUPER_ADMIN by default; other roles get an explicit subset.
const ROLE_PERMISSION_MAP: Record<string, string[]> = {
  SUPER_ADMIN: Object.values(PERMISSIONS),

  ADMIN: [
    PERMISSIONS.USER_CREATE_STAFF,
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_STATUS_UPDATE,
    PERMISSIONS.HOSPITAL_VIEW,
    PERMISSIONS.DEPARTMENT_MANAGE,
    PERMISSIONS.PATIENT_VIEW_ALL,
    PERMISSIONS.PATIENT_MANAGE,
    PERMISSIONS.PATIENT_ASSIGN,
    PERMISSIONS.PATIENT_TRANSFER_MANAGE,
    PERMISSIONS.APPOINTMENT_MANAGE_ANY,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.PRESCRIPTION_VIEW,
    PERMISSIONS.AMBULANCE_MANAGE,
    PERMISSIONS.AMBULANCE_TRIP_MANAGE,
    PERMISSIONS.AMBULANCE_TRIP_VIEW,
    PERMISSIONS.EMERGENCY_CASE_TRIAGE,
    PERMISSIONS.EMERGENCY_CASE_VIEW,
  ],

  DOCTOR: [
    PERMISSIONS.PATIENT_VIEW_ASSIGNED,
    PERMISSIONS.DIAGNOSIS_CREATE,
    PERMISSIONS.DIAGNOSIS_VIEW,
    PERMISSIONS.PRESCRIPTION_CREATE,
    PERMISSIONS.PRESCRIPTION_VIEW,
    PERMISSIONS.MEDICAL_NOTE_CREATE,
    PERMISSIONS.CLINICAL_NOTE_VIEW,
    PERMISSIONS.APPOINTMENT_MANAGE_OWN,
    PERMISSIONS.REPORT_UPLOAD,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.VITALS_VIEW,
    PERMISSIONS.PROFILE_MANAGE_OWN,
    PERMISSIONS.AMBULANCE_TRIP_VIEW,
    PERMISSIONS.EMERGENCY_CASE_VIEW,
  ],

  NURSE: [
    PERMISSIONS.PATIENT_VIEW_ASSIGNED,
    PERMISSIONS.PRESCRIPTION_VIEW,
    PERMISSIONS.DIAGNOSIS_VIEW,
    PERMISSIONS.VITALS_RECORD,
    PERMISSIONS.VITALS_VIEW,
    PERMISSIONS.NURSING_NOTE_CREATE,
    PERMISSIONS.CLINICAL_NOTE_VIEW,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.PROFILE_MANAGE_OWN,
    PERMISSIONS.AMBULANCE_TRIP_VIEW,
  ],

  PATIENT: [
    PERMISSIONS.PROFILE_MANAGE_OWN,
    PERMISSIONS.APPOINTMENT_BOOK,
    PERMISSIONS.PRESCRIPTION_VIEW,
    PERMISSIONS.MEDICAL_HISTORY_VIEW_OWN,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.PATIENT_VIEW_OWN,
    PERMISSIONS.AMBULANCE_TRIP_VIEW,
  ],

  DRIVER: [
    PERMISSIONS.PROFILE_MANAGE_OWN,
    PERMISSIONS.AMBULANCE_TRIP_VIEW,
    PERMISSIONS.AMBULANCE_TRIP_DRIVE,
    PERMISSIONS.EMERGENCY_CASE_MANAGE,
    PERMISSIONS.EMERGENCY_CASE_VIEW,
    // Needed by the emergency console: browsing every hospital to pick a
    // destination (HOSPITAL_VIEW isn't hospital-scoped — see
    // hospitals.service.ts#listHospitals — a driver has to be able to see
    // hospitals other than their own to route an emergency there), and
    // searching for a registered patient to attach to a case (USER_VIEW;
    // read-only — write actions on users need separate permissions the
    // driver still doesn't have).
    PERMISSIONS.HOSPITAL_VIEW,
    PERMISSIONS.USER_VIEW,
  ],
};

async function main() {
  console.log("Seeding permissions...");
  for (const code of Object.values(PERMISSIONS)) {
    const [module] = code.split(".");
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code, module, description: code.replace(/\./g, " ") },
    });
  }

  console.log("Seeding roles...");
  for (const role of ROLES) {
    await prisma.role.upsert({ where: { code: role.code }, update: {}, create: role });
  }

  console.log("Mapping role permissions...");
  for (const [roleCode, permCodes] of Object.entries(ROLE_PERMISSION_MAP)) {
    const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
    const permissions = await prisma.permission.findMany({ where: { code: { in: permCodes } } });

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }

  console.log("Ensuring initial super admin...");
  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { code: "SUPER_ADMIN" } });
  const email = process.env.SEED_SUPERADMIN_EMAIL ?? "superadmin@hms.local";
  const password = process.env.SEED_SUPERADMIN_PASSWORD ?? "ChangeMe!12345";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: "System",
        lastName: "Administrator",
        roleId: superAdminRole.id,
        status: "ACTIVE",
        isEmailVerified: true,
        mustChangePassword: true,
      },
    });
    console.log(`Super admin created: ${email} (temp password: ${password}) — change on first login.`);
  } else {
    console.log("Super admin already exists, skipping.");
  }

  // ---------------------------------------------------------------------
  // Local dev test accounts — NEVER run in production. Guarded by NODE_ENV
  // so this block is a no-op if the seed script is ever pointed at a real
  // deployment by mistake.
  // ---------------------------------------------------------------------
  if (process.env.NODE_ENV !== "production") {
    console.log("Seeding local dev test accounts...");

    const devHospital = await prisma.hospital.upsert({
      where: { code: "DEV-01" },
      update: { latitude: 18.5204, longitude: 73.8567 },
      // Coordinates: Pune, Maharashtra — used as the "from" side for
      // ambulance dispatch demos and as the OSRM route origin/destination.
      create: { name: "Dev General Hospital", code: "DEV-01", isActive: true, latitude: 18.5204, longitude: 73.8567 },
    });

    // A second hospital, geographically distinct, so the interhospital
    // transfer + ambulance dispatch flow is testable end-to-end out of the
    // box (real driving route + non-trivial ETA between the two).
    const devHospital2 = await prisma.hospital.upsert({
      where: { code: "DEV-02" },
      update: { latitude: 18.6298, longitude: 73.7997 },
      // Coordinates: Pimpri-Chinchwad, Maharashtra (~20km from DEV-01).
      create: { name: "Dev City Hospital", code: "DEV-02", isActive: true, latitude: 18.6298, longitude: 73.7997 },
    });

    const devDepartment = await prisma.department.upsert({
      where: { hospitalId_name: { hospitalId: devHospital.id, name: "General Medicine" } },
      update: {},
      create: { hospitalId: devHospital.id, name: "General Medicine" },
    });
    console.log(`Dev hospitals ready: ${devHospital.name} (${devHospital.code}), ${devHospital2.name} (${devHospital2.code})`);

    const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: "ADMIN" } });
    const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@hms.local";
    const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!12345";

    const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!existingAdmin) {
      const adminPasswordHash = await argon2.hash(adminPassword, { type: argon2.argon2id });
      await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash: adminPasswordHash,
          firstName: "Test",
          lastName: "Admin",
          roleId: adminRole.id,
          hospitalId: devHospital.id,
          status: "ACTIVE",
          isEmailVerified: true,
          mustChangePassword: false,
          adminProfile: { create: {} },
        },
      });
      console.log(`Dev admin created: ${adminEmail} (password: ${adminPassword}) — hospital: ${devHospital.name}`);
    } else {
      console.log("Dev admin already exists, skipping.");
    }

    const doctorRole = await prisma.role.findUniqueOrThrow({ where: { code: "DOCTOR" } });
    const doctorEmail = process.env.SEED_DOCTOR_EMAIL ?? "doctor@hms.local";
    const doctorPassword = process.env.SEED_DOCTOR_PASSWORD ?? "ChangeMe!12345";

    let doctorUser = await prisma.user.findUnique({ where: { email: doctorEmail }, include: { doctorProfile: true } });
    if (!doctorUser) {
      const doctorPasswordHash = await argon2.hash(doctorPassword, { type: argon2.argon2id });
      doctorUser = await prisma.user.create({
        data: {
          email: doctorEmail,
          passwordHash: doctorPasswordHash,
          firstName: "Test",
          lastName: "Doctor",
          roleId: doctorRole.id,
          hospitalId: devHospital.id,
          departmentId: devDepartment.id,
          status: "ACTIVE",
          isEmailVerified: true,
          mustChangePassword: false,
          doctorProfile: {
            create: {
              specialization: "General Medicine",
              licenseNumber: "DEV-LIC-0001",
              qualification: "MBBS",
              yearsOfExperience: 5,
            },
          },
        },
        include: { doctorProfile: true },
      });
      console.log(
        `Dev doctor created: ${doctorEmail} (password: ${doctorPassword}) — hospital: ${devHospital.name} / ${devDepartment.name}`
      );
    } else {
      console.log("Dev doctor already exists, skipping.");
    }

    const nurseRole = await prisma.role.findUniqueOrThrow({ where: { code: "NURSE" } });
    const nurseEmail = process.env.SEED_NURSE_EMAIL ?? "nurse@hms.local";
    const nursePassword = process.env.SEED_NURSE_PASSWORD ?? "ChangeMe!12345";

    let nurseUser = await prisma.user.findUnique({ where: { email: nurseEmail }, include: { nurseProfile: true } });
    if (!nurseUser) {
      const nursePasswordHash = await argon2.hash(nursePassword, { type: argon2.argon2id });
      nurseUser = await prisma.user.create({
        data: {
          email: nurseEmail,
          passwordHash: nursePasswordHash,
          firstName: "Test",
          lastName: "Nurse",
          roleId: nurseRole.id,
          hospitalId: devHospital.id,
          departmentId: devDepartment.id,
          status: "ACTIVE",
          isEmailVerified: true,
          mustChangePassword: false,
          nurseProfile: { create: { licenseNumber: "DEV-LIC-0002", shift: "Day" } },
        },
        include: { nurseProfile: true },
      });
      console.log(
        `Dev nurse created: ${nurseEmail} (password: ${nursePassword}) — hospital: ${devHospital.name} / ${devDepartment.name}`
      );
    } else {
      console.log("Dev nurse already exists, skipping.");
    }

    const patientRole = await prisma.role.findUniqueOrThrow({ where: { code: "PATIENT" } });
    const patientEmail = process.env.SEED_PATIENT_EMAIL ?? "patient@hms.local";
    const patientPassword = process.env.SEED_PATIENT_PASSWORD ?? "ChangeMe!12345";

    let patientUser = await prisma.user.findUnique({ where: { email: patientEmail }, include: { patientProfile: true } });
    if (!patientUser) {
      const patientPasswordHash = await argon2.hash(patientPassword, { type: argon2.argon2id });
      patientUser = await prisma.user.create({
        data: {
          email: patientEmail,
          passwordHash: patientPasswordHash,
          firstName: "Test",
          lastName: "Patient",
          roleId: patientRole.id,
          status: "ACTIVE",
          isEmailVerified: true,
          mustChangePassword: false,
          patientProfile: { create: { medicalRecordNo: "DEV-MRN-0001", bloodGroup: "O+" } },
        },
        include: { patientProfile: true },
      });
      console.log(`Dev patient created: ${patientEmail} (password: ${patientPassword})`);
    } else {
      console.log("Dev patient already exists, skipping.");
    }

    // Pre-assign the dev patient to the dev doctor so the full clinical
    // workflow (diagnosis → prescription → vitals → notes) is testable
    // immediately without a manual assignment step.
    if (doctorUser.doctorProfile && patientUser.patientProfile) {
      await prisma.doctorPatientMap.upsert({
        where: {
          doctorId_patientId: { doctorId: doctorUser.doctorProfile.id, patientId: patientUser.patientProfile.id },
        },
        update: { isActive: true },
        create: { doctorId: doctorUser.doctorProfile.id, patientId: patientUser.patientProfile.id },
      });
      console.log(`Dev patient assigned to dev doctor.`);
    }

    if (nurseUser.nurseProfile && patientUser.patientProfile) {
      await prisma.nursePatientMap.upsert({
        where: {
          nurseId_patientId: { nurseId: nurseUser.nurseProfile.id, patientId: patientUser.patientProfile.id },
        },
        update: { isActive: true },
        create: { nurseId: nurseUser.nurseProfile.id, patientId: patientUser.patientProfile.id },
      });
      console.log(`Dev patient assigned to dev nurse.`);
    }

    const driverRole = await prisma.role.findUniqueOrThrow({ where: { code: "DRIVER" } });
    const driverEmail = process.env.SEED_DRIVER_EMAIL ?? "driver@hms.local";
    const driverPassword = process.env.SEED_DRIVER_PASSWORD ?? "ChangeMe!12345";

    let driverUser = await prisma.user.findUnique({ where: { email: driverEmail } });
    if (!driverUser) {
      const driverPasswordHash = await argon2.hash(driverPassword, { type: argon2.argon2id });
      driverUser = await prisma.user.create({
        data: {
          email: driverEmail,
          passwordHash: driverPasswordHash,
          firstName: "Test",
          lastName: "Driver",
          roleId: driverRole.id,
          hospitalId: devHospital.id,
          status: "ACTIVE",
          isEmailVerified: true,
          mustChangePassword: false,
          driverProfile: { create: { licenseNumber: "DEV-DL-0001" } },
        },
      });
      console.log(`Dev driver created: ${driverEmail} (password: ${driverPassword}) — hospital: ${devHospital.name}`);
    } else {
      console.log("Dev driver already exists, skipping.");
    }

    const devAmbulance = await prisma.ambulance.upsert({
      where: { vehicleNumber: "AMB-DEV-01" },
      update: {},
      create: {
        hospitalId: devHospital.id,
        vehicleNumber: "AMB-DEV-01",
        status: "AVAILABLE",
        currentLat: devHospital.latitude,
        currentLng: devHospital.longitude,
        lastLocationAt: new Date(),
      },
    });
    console.log(`Dev ambulance ready: ${devAmbulance.vehicleNumber} at ${devHospital.name}`);
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());