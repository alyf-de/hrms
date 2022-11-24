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
					onchange: function() {
						dialog.set_df_property("days_section", "hidden", 1);
						dialog.set_df_property("status", "hidden", 1);
						dialog.set_df_property("exclude_holidays", "hidden", 1);
						dialog.set_df_property("include_today_and_future_days", "hidden", 1);
						dialog.get_field("start_date").value = null;
						dialog.get_field("start_date").refresh();
						dialog.get_field("end_date").value = null;
						dialog.get_field("end_date").refresh();
						dialog.set_df_property("unmarked_days", "options", []);
						dialog.no_unmarked_days_left = false;
					}
				},
				{
					label: __("Time Period"),
					fieldtype: "Section Break",
					fieldname: "time_period_section",
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
					hidden: 1,
					reqd: 1,

				},
				{
					label: __("Exclude Holidays"),
					fieldtype: "Check",
					fieldname: "exclude_holidays",
					hidden: 1,
					onchange: () => me.get_unmarked_days(dialog),
				},
				{
					label: __("Include Today and Future Days"),
					fieldtype: "Check",
					fieldname: "include_today_and_future_days",
					hidden: 0,
					onchange: () => me.get_unmarked_days(dialog),
				},
				{
					label: __("Unmarked Attendance for days"),
					fieldname: "unmarked_days",
					fieldtype: "MultiCheck",
					options: [],
					columns: 2,
					hidden: 1
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

	get_unmarked_days: function(dialog) {
		if (dialog.fields_dict.employee.value && dialog.fields_dict.start_date.value && dialog.fields_dict.end_date.value) {
			if (dialog.get_field("end_date").value < frappe.datetime.get_today()) {
				dialog.get_field("include_today_and_future_days").value = false;
				dialog.get_field("include_today_and_future_days").refresh();
				dialog.set_df_property("include_today_and_future_days", "hidden", 1);
			} else {
				dialog.set_df_property("include_today_and_future_days", "hidden", 0);
			}
			
			dialog.set_df_property("days_section", "hidden", 0);
			dialog.set_df_property("status", "hidden", 0);
			dialog.set_df_property("exclude_holidays", "hidden", 0);
			dialog.no_unmarked_days_left = false;
			this.get_multi_select_options(
				dialog.fields_dict.employee.value,
				dialog.fields_dict.start_date.value,
				dialog.fields_dict.end_date.value,
				dialog.fields_dict.exclude_holidays.get_value(),
				dialog.fields_dict.include_today_and_future_days.get_value(),
			).then(options => {
				dialog.set_df_property("unmarked_days", "options", []);
				if (options.length > 0) {
					dialog.set_df_property("unmarked_days", "hidden", 0);
					dialog.set_df_property("unmarked_days", "options", options);
				} else {
					dialog.no_unmarked_days_left = true;
				}
			});
		}
	},

	get_multi_select_options: function(employee, start_date, end_date, exclude_holidays, include_today_and_future_days) {
		return new Promise(resolve => {
			frappe.call({
				method: 'hrms.hr.doctype.attendance.attendance.get_unmarked_days',
				async: false,
				args: {
					employee: employee,
					start_date: start_date,
					end_date: end_date,
					exclude_holidays: exclude_holidays,
					include_today_and_future_days: include_today_and_future_days,
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
				resolve(options);
			});
		});
	}
};
