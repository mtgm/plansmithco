import { Edit, useForm } from "@refinedev/antd";
import { Form, Input } from "antd";

export const SetEdit = () => {
    const { formProps, saveButtonProps, queryResult } = useForm();

    return (
        <Edit saveButtonProps={saveButtonProps}>
            <Form {...formProps} layout="vertical">
                <Form.Item
                    label="Takım Adı"
                    name="name"
                    rules={[
                        {
                            required: true,
                            message: "Lütfen takım adını giriniz",
                        },
                    ]}
                >
                    <Input />
                </Form.Item>
            </Form>
        </Edit>
    );
};
