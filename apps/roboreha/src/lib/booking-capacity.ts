type CapacityClient = {
  query: (text: string, values: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

export class BookingCapacityError extends Error {}

export function equipmentCategory(requiredModelType: string) {
  return requiredModelType === "lower_limb" ? "treadmill" : "bench";
}

export async function validateConfiguredCapacity(
  client: CapacityClient,
  values: { storeId: string; requiredModelType: string; halUnitId: string; startAt: Date; endAt: Date; excludeAppointmentId?: string },
) {
  const excludeId = values.excludeAppointmentId ?? null;
  const hal = await client.query(
    `SELECT h.model_number,COALESCE(sum(fem.quantity),0)::int AS configured_quantity
       FROM hal_units h
       LEFT JOIN facility_equipment_models fem ON fem.store_id=h.store_id AND fem.category='hal' AND fem.model_number=h.model_number
      WHERE h.id=$1 AND h.store_id=$2 GROUP BY h.model_number`,
    [values.halUnitId, values.storeId],
  );
  const selectedHal = hal.rows[0] as { model_number: string; configured_quantity: number } | undefined;
  if (!selectedHal || Number(selectedHal.configured_quantity) < 1) {
    throw new BookingCapacityError("機材管理で利用可能なHAL台数が登録されていません。機材管理を確認してください。");
  }
  await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`booking:hal:${values.storeId}:${selectedHal.model_number}`]);
  const usedHalModel = await client.query(
    `SELECT count(*)::int AS count FROM appointments a JOIN hal_units h ON h.id=a.hal_unit_id
      WHERE a.store_id=$1 AND a.id<>COALESCE($2::uuid,'00000000-0000-0000-0000-000000000000')
        AND a.status IN ('reserved','confirmed','checked_in','in_session') AND a.start_at<$4 AND a.end_at>$3
        AND h.model_number=$5`,
    [values.storeId, excludeId, values.startAt.toISOString(), values.endAt.toISOString(), selectedHal.model_number],
  );
  if (Number(usedHalModel.rows[0]?.count ?? 0) >= Number(selectedHal.configured_quantity)) {
    throw new BookingCapacityError(`${selectedHal.model_number}の登録台数上限に達しています。別のHAL機器または時間を選択してください。`);
  }

  const category = equipmentCategory(values.requiredModelType);
  await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`booking:space:${values.storeId}:${category}`]);
  const capacity = await client.query(
    `SELECT COALESCE(sum(quantity*hal_capacity_per_unit),0)::int AS capacity FROM facility_equipment_models WHERE store_id=$1 AND category=$2`,
    [values.storeId, category],
  );
  const used = await client.query(
    `SELECT count(*)::int AS count FROM appointments a JOIN service_products p ON p.id=a.product_id
      WHERE a.store_id=$1 AND a.id<>COALESCE($2::uuid,'00000000-0000-0000-0000-000000000000')
        AND a.status IN ('reserved','confirmed','checked_in','in_session') AND a.start_at<$4 AND a.end_at>$3
        AND CASE WHEN p.required_model_type='lower_limb' THEN 'treadmill' ELSE 'bench' END=$5`,
    [values.storeId, excludeId, values.startAt.toISOString(), values.endAt.toISOString(), category],
  );
  if (Number(used.rows[0]?.count ?? 0) >= Number(capacity.rows[0]?.capacity ?? 0)) {
    throw new BookingCapacityError(`${category === "treadmill" ? "トレッドミル" : "ベンチ"}の機材管理上限に達しています。別の時間を選択してください。`);
  }
}
