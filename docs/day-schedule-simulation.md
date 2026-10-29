# Симуляция расписания — XState v5

Для вставки одним фрагментом: [day-schedule.simulator.js](./day-schedule.simulator.js). Это сгенерированный bundle двух независимых машин `dayScheduleMachine` и `meetingEditorMachine`, с единственной внешней зависимостью `xstate`. Исходные конфигурации: [day-schedule.machine.js](./day-schedule.machine.js); чистая логика: [day-schedule.logic.js](./day-schedule.logic.js). Для Stately Studio использовать импорт кода в новую машину и режим Simulate. Импортёр Studio может переносить структуру без исполняемых реализаций actions/guards: если среда предлагает выбирать guard вручную, для проверки данных и проекции нужен исполняющий JavaScript симулятор. Проверка ниже относится к XState runtime, а не к непроверенному импорту в веб-интерфейс.

Это самодостаточная симуляционная модель. Реальных API-запросов, таймеров и библиотек проекта нет. В production ответы `schedule.load.*` и `schedule.mutation.*` заменяются invoke/fromPromise и onDone/onError, а функции расписания — методами entity. Текущая дата/время фиксированы, обновление часов — явным clock.changed. Сохранять можно только встречи с началом строго позже now.

После разделения пройдены **32 runtime-проверки на XState 5.33.2**: создание/изменение/удаление, guards, откат, сохранение черновика, обновление после 409, отмена и смена даты. Посещены все 5 состояний редактора и 8 устойчивых состояний родителя; ready.route является мгновенным маршрутизирующим состоянием. Для проверки использован существующий кэш XState; зависимости проекта не устанавливались. Импорт в веб-интерфейс Studio отдельно не проверялся.

Начальные условия: выбран день **2030-01-15**, now **09:00**. Рабочие часы 09:00–18:00. Начальная бронь `meeting-A`: 12:00–13:00, черновик: 10:00–11:00. Значения времени заданы **номерами минут суток**, а не HH:mm. Слоты — 1440 элементов id/null. Для удобного просмотра context каталог встреч представлен объектом по id вместо Map.

## Разделение ответственности

`dayScheduleMachine` владеет подтверждённым и оптимистическим расписанием, загрузкой, сетевыми исходами, созданием и удалением. В её context нет черновика редактируемой встречи: `creationDraft` относится только к созданию. `editorMeetingId` указывает открытый редактор, а `pendingOperation.meeting` — зафиксированный payload отправленной операции, не изменяемая форма.

`meetingEditorMachine` владеет `original`, `draft`, ошибками валидации и состояниями closed/editing/submitting/conflict/failed. Ссылка `schedule` — неизменяемый снимок для проверки доступности; редактор не изменяет расписание и не выполняет HTTP. В production guards обеих машин используют одни и те же методы entity, не дублируют правила.

Родитель вызывает редактор через корневой `invoke` с id `meetingEditor`. Он живёт до остановки родителя, включая saving/refreshing/refreshFailed. `input` не используется для реактивной синхронизации: обновлённое расписание передаётся событием schedule.changed, часы — clock.changed. Эти события не переписывают original/draft.

```text
UI → dayScheduleMachine → meetingEditorMachine
     meeting.draft.changed/meeting.save.requested      original + draft
                       ← editor.save.requested(meeting)
     optimistic update
     API outcome       → editor.save.succeeded / editor.save.conflicted / editor.save.failed
     refreshed data    → schedule.changed
```

Запрос редактирования повторно проверяется родителем по актуальному расписанию перед оптимистическим изменением. Если операция уже недопустима, он отправляет editor.save.rejected. При ошибке и 409 редактор сохраняется, при успешном сохранении закрывается. meeting.edit.cancelled закрывает редактор без записи; смена даты отправляет editor.reset.requested. Во время submitting отмена и повторное сохранение не обрабатываются.

В приложении определение редактора размещается в `features/meeting-editor/model`, координирующая машина — в модели страницы, доменные сущности — в `entities`. Для симуляции instantiate/start нужно именно `dayScheduleMachine`: редактор использует sendParent и не предназначен для отправки meeting.save.requested без родительского актора.

## Чистые guards и действия

`day-schedule.logic.js` не импортирует XState и не запускает акторы. Методы получают `(context, event)` и разделены по результату:

- `editorGuards`, `scheduleGuards` возвращают boolean.
- `editorUpdates`, `scheduleUpdates` возвращают частичный новый context, не изменяя входные данные.
- `editorMessages`, `scheduleMessages` конструируют объекты событий без их отправки.
- `createEditorContext`, `createScheduleContext` создают независимые начальные данные.

В конфигурациях машины остаются только переходы и адаптеры: `bindGuards` передаёт аргументы в чистые проверки; `bindUpdates` применяет изменения через assign; sendTo/sendParent отправляют события, построенные чистыми методами. Отправка сообщения — эффект, поэтому сама она не объявляется чистой функцией. Изменения контекста вычисляются заново на каждом выполнении action с актуальными данными.

Пример прямого вызова без машины:

```js
import { editorGuards, editorUpdates } from "./day-schedule.logic.js";

const intersects = editorGuards.intersectsMeeting(editorContext);
const patch = editorUpdates.changeDraft(editorContext, {
  type: "meeting.draft.changed",
  patch: { title: "Новое название" },
});
// editorContext не изменился; patch содержит новый draft и сброс ошибок.
```

Изолированные тесты: [day-schedule.logic.test.js](./day-schedule.logic.test.js).

```sh
bun test ./docs/day-schedule.logic.test.js
```

Проверено после извлечения: **82 теста** чистых функций, включая замороженные входы, границы интервалов, самоконфликт, оптимистические изменения, commit/rollback и сообщения. Дополнительно до/после рефакторинга сравнены **30 сценариев, 129 переходов** двух акторов на XState 5.33.2: состояния и контекст совпали. Эти тесты относятся к симуляционной модели; `bun run check` шаблона запускает только тесты из src и не включает этот файл docs.

После изменения исходников пересобирать файл для вставки; bundle вручную не редактировать:

```sh
bun build ./docs/day-schedule.machine.js --target=browser --external=xstate --outfile=./docs/day-schedule.simulator.js
```

## События

События передаются объектами с обязательным строковым `type`, как требует XState v5. Принято соглашение проекта: строчные слова, разделённые точками, в формате «область.действие.результат». Сам XState не требует конкретного регистра. Контракт одинаков в `on`, `sendTo`, `sendParent` и примерах; историческая переписка сохраняет исходные имена.

| Назначение | События |
| --- | --- |
| Часы | `clock.changed` |
| Дата и загрузка дня | `schedule.date.selected`, `schedule.load.succeeded`, `schedule.load.failed`, `schedule.load.retry` |
| Обновлённый снимок для редактора | `schedule.changed` |
| Результат API-мутации | `schedule.mutation.succeeded`, `schedule.mutation.conflicted`, `schedule.mutation.failed` |
| Форма встречи | `meeting.creation.requested`, `meeting.edit.requested`, `meeting.draft.changed`, `meeting.save.requested`, `meeting.edit.cancelled` |
| Удаление | `meeting.delete.requested`, `meeting.delete.confirmed`, `meeting.delete.cancelled` |
| Управление дочерним редактором | `editor.open.requested`, `editor.reset.requested`, `editor.closed` |
| Сохранение между акторами | `editor.save.requested`, `editor.save.succeeded`, `editor.save.conflicted`, `editor.save.failed`, `editor.save.rejected` |

`meeting.save.requested` — команда пользователя. `editor.save.requested` — проверенный запрос редактора родителю. `schedule.mutation.*` — моделируемый исход HTTP, `editor.save.*` — ответ родителя редактору. Коды ошибок вроде `TIME_OCCUPIED` и дискриминаторы операций `create/update/delete` событиями XState не являются.

После переименования проверены все 25 типов событий: формат имён, наличие в документации и обработчики для отправляемых событий. Дополнительно прошли 10 runtime-сценариев протокола двух машин на XState 5.33.2, включая успех, ошибки, 409, отмены, синхронизацию и смену даты. Основание контракта: [XState — Events and transitions](https://stately.ai/docs/transitions).

Каждую независимую последовательность начинать с перезапуска симуляции.

| Сценарий | Последовательность событий | Проверить |
| --- | --- | --- |
| Первичная ошибка | `schedule.load.failed` → `schedule.load.retry` → `schedule.load.succeeded` | loading → loadFailed → loading → ready.creating |
| Пустой день | `{"type":"schedule.load.succeeded","meetings":[]}` | Пустой каталог, все слоты null |
| Успешное создание | `schedule.load.succeeded` → `meeting.save.requested` → `schedule.mutation.succeeded` → `schedule.load.succeeded` | В saving виден temporary-1, после успеха server-1; refreshing не повторяет POST |
| Ошибка сохранения | `schedule.load.succeeded` → `meeting.save.requested` → `schedule.mutation.failed` | Откат к подтверждённым данным; черновик сохранён |
| Ошибка обновления после успеха | `schedule.load.succeeded` → `meeting.save.requested` → `schedule.mutation.succeeded` → `schedule.load.failed` → `schedule.load.retry` → `schedule.load.succeeded` | Сохранённая встреча остаётся; повторяется только загрузка |
| Конфликт и ошибка refresh | `schedule.load.succeeded` → `meeting.save.requested` → `schedule.mutation.conflicted` → `schedule.load.failed` → `schedule.load.retry` → `schedule.load.succeeded` | Ошибка 409, черновик сохранён, optimistic откатан; доступен повтор GET |
| Редактирование без самоконфликта | `schedule.load.succeeded` → `{"type":"meeting.edit.requested","meetingId":"meeting-A"}` → `meeting.save.requested` | Родитель ready.editingMeeting → saving; ребёнок editing → submitting; собственные слоты разрешены |
| Отмена редактирования | `schedule.load.succeeded` → `{"type":"meeting.edit.requested","meetingId":"meeting-A"}` → `meeting.draft.changed` → `meeting.edit.cancelled` | Редактор closed, родитель ready.creating; исходная встреча не меняется |
| Ошибка PATCH | `schedule.load.succeeded` → `{"type":"meeting.edit.requested","meetingId":"meeting-A"}` → `meeting.save.requested` → `schedule.mutation.failed` | Редактор failed с сохранённым draft; родитель ready.editingMeeting с откатом |
| Конфликт PATCH | `schedule.load.succeeded` → `{"type":"meeting.edit.requested","meetingId":"meeting-A"}` → `meeting.save.requested` → `schedule.mutation.conflicted` → `schedule.load.succeeded` | Редактор conflict с сохранённым draft и новым schedule; можно исправить и повторить |
| Отмена удаления | `schedule.load.succeeded` → `{"type":"meeting.delete.requested","meetingId":"meeting-A"}` → `meeting.delete.cancelled` | ready.confirmingDelete → ready.creating; расписание не меняется |
| Удаление с откатом | `schedule.load.succeeded` → `{"type":"meeting.delete.requested","meetingId":"meeting-A"}` → `meeting.delete.confirmed` → `schedule.mutation.failed` | В saving встреча исчезла, после ошибки вернулась |
| Успешное удаление | `schedule.load.succeeded` → `{"type":"meeting.delete.requested","meetingId":"meeting-A"}` → `meeting.delete.confirmed` → `schedule.mutation.succeeded` → `schedule.load.succeeded` | Встреча удалена из обеих версий |
| Смена даты | `schedule.load.succeeded` → `{"type":"schedule.date.selected","date":"2030-01-16"}` → `schedule.load.succeeded` | Новый день загружен, форма сброшена |

Событие без payload, например `meeting.save.requested`, передавать как `{"type":"meeting.save.requested"}`.

## Проверки guards

Сначала отправить `schedule.load.succeeded`, затем `meeting.draft.changed` с указанным patch и `meeting.save.requested`. При создании родитель остаётся в ready.creating; причина появляется в его context.validationError. При редактировании эти события пересылаются ребёнку; ошибка появляется в его context.validationError, а родитель остаётся в ready.editingMeeting.

| Проверка | patch | Результат |
| --- | --- | --- |
| Рабочие часы | `{"start":530,"end":590}` | OUTSIDE_WORKING_TIME |
| Занятость | `{"start":750,"end":810}` | TIME_OCCUPIED |
| Минимум | `{"start":600,"end":629}` | INVALID_DURATION |
| Максимум | `{"start":540,"end":661}` | INVALID_DURATION |
| Обратный интервал | `{"start":660,"end":600}` | INVALID_INTERVAL |
| Прошедшее время | `{"start":540,"end":600}` | PAST_TIME: now уже 09:00 |
| Касание границы | `{"start":660,"end":720}` | Переход в saving, meeting-A начинается с 720 |

Пример изменения черновика:

```json
{"type":"meeting.draft.changed","patch":{"start":750,"end":810,"title":"Conflict test"}}
```

Для начавшейся встречи отправить `{"type":"clock.changed","now":{"date":"2030-01-15","minute":720}}`, затем meeting.edit.requested или meeting.delete.requested с meetingId `meeting-A`: операция запрещена. Если часы перевести после открытия подтверждения удаления, запрет срабатывает повторно на meeting.delete.confirmed.

## Воспроизведение настоящего конкурентного расписания

После `schedule.load.succeeded` → `meeting.save.requested` → `schedule.mutation.conflicted` отправить:

```json
{
  "type": "schedule.load.succeeded",
  "meetings": [
    {"id":"meeting-A","start":720,"end":780,"title":"Existing meeting"},
    {"id":"meeting-B","start":600,"end":660,"title":"Concurrent meeting"}
  ]
}
```

Черновик 600–660 остаётся. Повторный meeting.save.requested блокируется локальной проверкой TIME_OCCUPIED. Изменить интервал на 660–720 и повторить meeting.save.requested: он разрешён.

## Ограничения модели

- В loading и refreshing результаты API задаются вручную; при schedule.load.succeeded без meetings первичная загрузка использует seed, refresh сохраняет уже подтверждённые данные.
- Во время saving и refreshing смена даты и новые мутации не обрабатываются. При refreshFailed разрешены повтор GET или переход на другую дату.
- Контекст редактора доступен через `actor.getSnapshot().children.meetingEditor.getSnapshot().context`; его состояние — там же в `value`. В context родителя находится только creationDraft, не draft редактора.
- Симулируемые ответы считаются валидными серверными DTO. Production mapper обязан валидировать входные данные и не допускать пересечения при построении расписания.
- Guards сначала проверяют форму интервала, затем workingTime и свободные слоты, потом длительность и прошлое. Исключение собственных слотов берётся из редактируемой встречи, не из поля расписания.
- В context нет isLoading/isSaving и stored availableTime: жизненный цикл задаётся состоянием машины, доступность вычисляется по слотам.
- Проверки исходного entity и transport, реактивные часы, ошибки 404 и согласование неизвестного исхода сетевой записи потребуют детализации при реализации приложения. Это модель переходов для обсуждения архитектуры.
