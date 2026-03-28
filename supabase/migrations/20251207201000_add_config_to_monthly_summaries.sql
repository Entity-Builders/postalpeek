alter table monthly_summaries 
add column if not exists savings_percentage numeric,
add column if not exists monthly_income numeric;

alter table monthly_summaries
add constraint monthly_summaries_user_month_key unique (user_id, month);
