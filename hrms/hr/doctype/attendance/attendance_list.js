frappe.listview_settings['Attendance'] = {
	add_fields: ["status", "attendance_date"],
	
	get_indicator: function (doc) {
		if (["Present", "Work From Home"].includes(doc.status)) {
			return [__(doc.status), "green", "status,=," + doc.status];
		} else if (["Absent", "On Leave"].includes(doc.status)) {
			return [__(doc.status), "red", "status,=," + doc.status];
		} else if (doc.status == "Half Day") {
			return [__(doc.status), "orange", "status,=," + doc.status];
		}
	},

	onload: function(list_view) {
		let me = this;
		list_view.page.add_inner_button(__("Mark Attendance"), function() {
			let dialog = new frappe.ui.Dialog({
				title: __("Mark Attendance"),
				fields: [{
					fieldname: 'employee',
					label: __('For Employee'),
					fieldtype: 'Link',
					options: 'Employee',
					get_query: () => {
						return {query: "erpnext.controllers.queries.employee_query"};
					},
					reqd: 1,
					onchange: () => me.reset_dialog(dialog),
				},
				{
					label: __("Time Period"),
					fieldtype: "Section Break",
					fieldname: "time_period_section",
					hidden: 1,
				},
				{
					label: __("Start"),
					fieldtype: "Date",
					fieldname: "start_date",
					reqd: 1,
					onchange: () => me.get_unmarked_days(dialog),
				},
				{
					fieldtype: "Column Break",
					fieldname: "time_period_column",
				},
				{
					label: __("End"),
					fieldtype: "Date",
					fieldname: "end_date",
					reqd: 1,
					onchange: () => me.get_unmarked_days(dialog),
				},
				{
					fieldtype: "Section Break",
					fieldname: "days_section",
					hidden: 1,
				},
				{
					label: __("Status"),
					fieldtype: "Select",
					fieldname: "status",
					options: ["Present", "Absent", "Half Day", "Work From Home"],
					reqd: 1,

				},
				{
					label: __("Exclude Holidays"),
					fieldtype: "Check",
					fieldname: "exclude_holidays",
					onchange: () => me.get_unmarked_days(dialog),
				},
				{
					label: __("Include Today and Future Days"),
					fieldtype: "Check",
					fieldname: "include_today_and_future_days",
					onchange: () => me.get_unmarked_days(dialog),
				},
				{
					label: __("Unmarked Attendance for days"),
					fieldname: "unmarked_days",
					fieldtype: "MultiCheck",
					options: [],
					columns: 2,
				}],
				primary_action(data) {
					if (cur_dialog.no_unmarked_days_left) {
						frappe.msgprint(__("Attendance from {0} to {1} has already been marked for the Employee {2}",
							[data.start_date, data.end_date, data.employee]));
					} else {
						frappe.confirm(__('Mark attendance as {0} for {1} on selected dates?', [data.status, data.employee]), () => {
							frappe.call({
								method: "hrms.hr.doctype.attendance.attendance.mark_bulk_attendance",
								args: {
									data: data
								},
								callback: function (r) {
									if (r.message === 1) {
										frappe.show_alert({
											message: __("Attendance Marked"),
											indicator: 'blue'
										});
										cur_dialog.hide();
									}
								}
							});
						});
					}
					dialog.hide();
					list_view.refresh();
				},
				primary_action_label: __('Mark Attendance')

			});
			dialog.show();
		});
	},

	reset_dialog: function(dialog) {
		var fields = dialog.fields_dict;

		dialog.set_df_property("time_period_section", "hidden", dialog.fields_dict.employee.value ? 0 : 1);
		dialog.set_df_property("days_section", "hidden", 1);
		dialog.set_df_property("unmarked_days", "options", []);
		dialog.no_unmarked_days_left = false;
		fields.start_date.set_value(null);
		fields.end_date.set_value(null);
		fields.exclude_holidays.value = false;
		fields.include_today_and_future_days.value = false;
	},

	get_unmarked_days: function(dialog) {
		var fields = dialog.fields_dict;

		if (fields.employee.value && fields.start_date.value && fields.end_date.value) {
			if (fields.end_date.value < frappe.datetime.get_today()) {
				fields.include_today_and_future_days.value = false;
				dialog.set_df_property("include_today_and_future_days", "hidden", 1);
			} else {
				dialog.set_df_property("include_today_and_future_days", "hidden", 0);
			}

			dialog.set_df_property("days_section", "hidden", 0);
			dialog.set_df_property("status", "hidden", 0);
			dialog.set_df_property("exclude_holidays", "hidden", 0);
			dialog.no_unmarked_days_left = false;

			frappe.call({
				method: 'hrms.hr.doctype.attendance.attendance.get_unmarked_days',
				async: false,
				args: {
					employee: fields.employee.value,
					start_date: fields.start_date.value,
					end_date: fields.end_date.value,
					exclude_holidays: fields.exclude_holidays.value,
					include_today_and_future_days: fields.include_today_and_future_days.value,
				}
			}).then(r => {
				var options = [];

				for (var d in r.message) {
					var momentObj = moment(r.message[d], 'YYYY-MM-DD');
					var date = momentObj.format('DD-MM-YYYY');
					options.push({
						"label": date,
						"value": r.message[d],
						"checked": 1
					});
				}

				dialog.set_df_property("unmarked_days", "options", options.length > 0 ? options : []);
				dialog.no_unmarked_days_left = options.length === 0;
			});
		}
	},

};
